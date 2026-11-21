const APPWRITE_ENDPOINT = "https://syd.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6afaee080036fbc10c12";
const ADMIN_TEAM_ID = "administradores";
const CATEGORIAS = ["Empresa", "Projetos", "Construção Civil", "Gestão", "Eventos"];

function responder(res, status, data) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(data);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return responder(res, 405, { error: "Método não permitido." });
    }

    const authorization = req.headers.authorization || "";
    const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

    if (!jwt) {
        return responder(res, 401, { error: "Sessão não encontrada. Inicia sessão novamente." });
    }

    const { GEMINI_API_KEY, APPWRITE_API_KEY } = process.env;
    if (!GEMINI_API_KEY || !APPWRITE_API_KEY) {
        console.error("Faltam variáveis de ambiente GEMINI_API_KEY ou APPWRITE_API_KEY.");
        return responder(res, 503, {
            error: "O serviço de geração ainda não está configurado no servidor. Contacta o administrador."
        });
    }

    try {
        // Valida o JWT diretamente no Appwrite; não confia em userId enviado pelo browser.
        const accountResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
            method: "GET",
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT_ID,
                "X-Appwrite-JWT": jwt
            }
        });

        if (!accountResponse.ok) {
            return responder(res, 401, { error: "A sessão expirou. Inicia sessão novamente." });
        }

        const utilizador = await accountResponse.json();

        // Confirma no servidor a membership e o papel admin usando uma API key privada.
        const membershipsResponse = await fetch(
            `${APPWRITE_ENDPOINT}/teams/${encodeURIComponent(ADMIN_TEAM_ID)}/memberships?limit=100`,
            {
                headers: {
                    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
                    "X-Appwrite-Key": APPWRITE_API_KEY
                }
            }
        );

        if (!membershipsResponse.ok) {
            console.error("Falha ao consultar memberships Appwrite:", membershipsResponse.status);
            return responder(res, 503, { error: "Não foi possível validar as permissões administrativas." });
        }

        const membershipsData = await membershipsResponse.json();
        const isAdmin = (membershipsData.memberships || []).some(membership =>
            membership.userId === utilizador.$id &&
            membership.confirm === true &&
            Array.isArray(membership.roles) &&
            membership.roles.includes("admin")
        );

        if (!isAdmin) {
            return responder(res, 403, { error: "Apenas administradores autorizados podem gerar notícias." });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const tema = String(body.tema || "").trim();
        const contexto = String(body.contexto || "").trim();
        const imagens = Array.isArray(body.imagens) ? body.imagens : (body.imagem ? [body.imagem] : []);
        if (imagens.length > 4) return responder(res, 400, { error: "Podes enviar no máximo 4 imagens para análise." });
        const imagensValidadas = imagens.map((imagem, indice) => ({
            mimeType: String(imagem?.mimeType || ""),
            data: String(imagem?.data || ""),
            indice: indice + 1
        }));
        const imagemInvalida = imagensValidadas.find(imagem => imagem.data && (
            !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imagem.mimeType) ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(imagem.data) || imagem.data.length > 1_000_000
        ));
        const totalBytesBase64 = imagensValidadas.reduce((total, imagem) => total + imagem.data.length, 0);
        if (imagemInvalida || totalBytesBase64 > 3_800_000) {
            return responder(res, 400, { error: "Imagem inválida ou demasiado grande. Usa até 4 imagens JPG, PNG, WebP ou GIF, com no máximo 700 KB cada." });
        }
        const temImagens = imagensValidadas.some(imagem => imagem.data);

        if (tema.length > 180 || (tema.length > 0 && tema.length < 5)) {
            return responder(res, 400, { error: "O tema deve ter entre 5 e 180 caracteres." });
        }
        if (!tema && !temImagens) {
            return responder(res, 400, { error: "Envia uma imagem ou indica o tema da notícia." });
        }
        if (contexto.length > 5000) {
            return responder(res, 400, { error: "O contexto não pode ultrapassar 5.000 caracteres." });
        }
        const modelos = [...new Set([
            process.env.GEMINI_MODEL,
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.5-flash"
        ].filter(Boolean))];

        const prompt = `És o redator editorial do blog institucional da KIKIAME, empresa angolana de Comércio Geral e Prestação de Serviços. Escreve em português claro, profissional e natural, adequado a leitores em Angola.

Cria um RASCUNHO de notícia com base exclusivamente nas informações abaixo e em TODAS as imagens anexadas, se existirem. Analisa cada imagem individualmente e cruza apenas os factos que forem consistentes entre elas.
Tema indicado: ${tema || "Não indicado; identifica o assunto principal na imagem."}
A categoria deve ser escolhida automaticamente por ti, de acordo com o assunto principal e o conteúdo confirmado.
Informações confirmadas fornecidas pelo administrador: ${contexto || "Não foram fornecidos factos adicionais."}

Se receberes várias imagens, analisa TODAS cuidadosamente: identifica em cada uma apenas elementos visíveis, texto legível e informações explicitamente apresentadas. Cruza imagens para reconhecer o mesmo evento ou assunto, mas não inventes dados ausentes nem combines contextos diferentes como se fossem um só. Em cartazes, utiliza apenas dados legíveis. Em fotografias, não deduzas datas, locais, nomes, causas, resultados ou acontecimentos que as imagens não comprovem. Se faltarem factos essenciais, escreve um rascunho prudente e assinala que é necessária confirmação do administrador.

Regras obrigatórias:
- Não inventes datas, nomes, locais, números, clientes, contratos, resultados, citações, parcerias ou acontecimentos.
- Não apresentes suposições como factos.
- Não afirmes que algo foi concluído, inaugurado ou realizado se isso não estiver confirmado.
- Não menciones que o texto foi escrito por IA.
- Produz um título objetivo, um resumo curto e um conteúdo estruturado em parágrafos.
- Devolve apenas JSON válido, sem Markdown, com as propriedades: titulo, resumo, categoria, conteudo.
- Escolhe automaticamente a categoria mais adequada, de acordo com o assunto principal. A categoria deve ser exatamente uma destas: ${CATEGORIAS.join(", ")}.
- O conteúdo deve ter entre 3 e 6 parágrafos, sem HTML.`;

        let geminiData = null;
        let ultimoErro = "";
        let ultimoStatus = 502;
        let modeloUtilizado = null;

        for (const modelo of modelos) {
            try {
                console.info(`A tentar gerar notícia com o modelo ${modelo}.`);
                const resposta = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: AbortSignal.timeout(35000),
                        body: JSON.stringify({
                            contents: [{
                                role: "user",
                                parts: [
                                    { text: prompt },
                                    ...imagensValidadas.filter(imagem => imagem.data).map(imagem => ({ inline_data: { mime_type: imagem.mimeType, data: imagem.data } }))
                                ]
                            }],
                            generationConfig: {
                                responseMimeType: "application/json",
                                temperature: 0.55,
                                maxOutputTokens: 1800
                            }
                        })
                    }
                );

                const dados = await resposta.json().catch(() => ({}));
                if (resposta.ok) {
                    geminiData = dados;
                    modeloUtilizado = modelo;
                    console.info(`Notícia gerada com sucesso pelo modelo ${modelo}.`);
                    break;
                }

                ultimoStatus = resposta.status;
                ultimoErro = dados?.error?.message || `HTTP ${resposta.status}`;
                console.error(`Modelo ${modelo} falhou (${resposta.status}):`, ultimoErro);

                // Só tenta outro modelo perante indisponibilidade, limite ou erro temporário do fornecedor.
                if (![404, 429, 500, 502, 503, 504].includes(resposta.status)) {
                    return responder(res, resposta.status === 400 ? 400 : 502, {
                        error: "O pedido foi rejeitado pelo serviço de IA. Verifica os dados enviados e tenta novamente."
                    });
                }
            } catch (erroModelo) {
                ultimoErro = erroModelo?.message || "Falha de comunicação com o modelo.";
                ultimoStatus = 504;
                console.error(`Modelo ${modelo} não respondeu:`, ultimoErro);
            }
        }

        if (!geminiData) {
            console.error("Todos os modelos Gemini configurados falharam.", { ultimoStatus, ultimoErro });
            return responder(res, 503, {
                error: "Os modelos de IA estão temporariamente indisponíveis. Foram tentadas várias alternativas; tenta novamente mais tarde."
            });
        }

        const text = geminiData?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!text) {
            return responder(res, 502, { error: "A IA devolveu uma resposta vazia. Tenta novamente." });
        }

        let noticia;
        try {
            noticia = JSON.parse(text);
        } catch {
            const cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
            noticia = JSON.parse(cleaned);
        }

        const noticiaCategoria = CATEGORIAS.includes(String(noticia.categoria || "").trim()) ? String(noticia.categoria).trim() : null;
        const resultado = {
            titulo: String(noticia.titulo || "").trim().slice(0, 255),
            resumo: String(noticia.resumo || "").trim().slice(0, 1500),
            categoria: noticiaCategoria,
            conteudo: String(noticia.conteudo || "").trim().slice(0, 20000)
        };

        if (!resultado.titulo || !resultado.conteudo || !resultado.categoria) {
            return responder(res, 502, { error: "O rascunho gerado está incompleto ou a IA não selecionou uma categoria válida. Tenta novamente." });
        }

        return responder(res, 200, resultado);
    } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            console.error("Timeout ao aguardar resposta do Gemini:", error?.name || "timeout");
            return responder(res, 504, { error: "A IA demorou demasiado tempo a responder. Tenta novamente dentro de alguns instantes." });
        }
        console.error("Erro interno em /api/generate-news:", error);
        return responder(res, 500, { error: "Ocorreu um erro interno ao gerar a notícia." });
    }
}
