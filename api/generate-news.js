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
        const categoria = String(body.categoria || "").trim();
        const imagem = body.imagem && typeof body.imagem === "object" ? body.imagem : null;
        const imagemMime = String(imagem?.mimeType || "");
        const imagemData = String(imagem?.data || "");

        if (tema.length > 180 || (tema.length > 0 && tema.length < 5)) {
            return responder(res, 400, { error: "O tema deve ter entre 5 e 180 caracteres." });
        }
        if (!tema && !imagemData) {
            return responder(res, 400, { error: "Envia uma imagem ou indica o tema da notícia." });
        }
        if (imagemData && (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imagemMime) || !/^[A-Za-z0-9+/]+={0,2}$/.test(imagemData) || imagemData.length > 4_200_000)) {
            return responder(res, 400, { error: "Imagem inválida ou demasiado grande. Usa JPG, PNG, WebP ou GIF até 3 MB." });
        }
        if (contexto.length > 5000) {
            return responder(res, 400, { error: "O contexto não pode ultrapassar 5.000 caracteres." });
        }
        if (!CATEGORIAS.includes(categoria)) {
            return responder(res, 400, { error: "Seleciona uma categoria válida." });
        }

        const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
        const prompt = `És o redator editorial do blog institucional da KIKIAME, empresa angolana de Comércio Geral e Prestação de Serviços. Escreve em português claro, profissional e natural, adequado a leitores em Angola.

Cria um RASCUNHO de notícia com base exclusivamente nas informações abaixo e na imagem anexada, se existir.
Tema indicado: ${tema || "Não indicado; identifica o assunto principal na imagem."}
Categoria pretendida: ${categoria}
Informações confirmadas fornecidas pelo administrador: ${contexto || "Não foram fornecidos factos adicionais."}

Se receberes uma imagem, analisa-a cuidadosamente: identifica apenas elementos visíveis, texto legível e informações explicitamente apresentadas. Em cartazes, utiliza apenas dados legíveis. Em fotografias, não deduzas datas, locais, nomes, causas, resultados ou acontecimentos que a imagem não comprove. Se faltarem factos essenciais, escreve um rascunho prudente e assinala que é necessária confirmação do administrador.

Regras obrigatórias:
- Não inventes datas, nomes, locais, números, clientes, contratos, resultados, citações, parcerias ou acontecimentos.
- Não apresentes suposições como factos.
- Não afirmes que algo foi concluído, inaugurado ou realizado se isso não estiver confirmado.
- Não menciones que o texto foi escrito por IA.
- Produz um título objetivo, um resumo curto e um conteúdo estruturado em parágrafos.
- Devolve apenas JSON válido, sem Markdown, com as propriedades: titulo, resumo, categoria, conteudo.
- A categoria deve ser exatamente uma destas: ${CATEGORIAS.join(", ")}.
- O conteúdo deve ter entre 3 e 6 parágrafos, sem HTML.`;

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: prompt },
                            ...(imagemData ? [{ inline_data: { mime_type: imagemMime, data: imagemData } }] : [])
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

        const geminiData = await geminiResponse.json().catch(() => ({}));
        if (!geminiResponse.ok) {
            console.error("Erro Gemini:", geminiResponse.status, geminiData?.error?.message || "");
            if (geminiResponse.status === 429) {
                return responder(res, 429, { error: "Limite temporário de utilização da IA atingido. Tenta novamente mais tarde." });
            }
            return responder(res, 502, { error: "A IA não conseguiu gerar o rascunho. Tenta novamente." });
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

        const noticiaCategoria = CATEGORIAS.includes(noticia.categoria) ? noticia.categoria : categoria;
        const resultado = {
            titulo: String(noticia.titulo || "").trim().slice(0, 255),
            resumo: String(noticia.resumo || "").trim().slice(0, 1500),
            categoria: noticiaCategoria,
            conteudo: String(noticia.conteudo || "").trim().slice(0, 20000)
        };

        if (!resultado.titulo || !resultado.conteudo) {
            return responder(res, 502, { error: "O rascunho gerado está incompleto. Tenta novamente." });
        }

        return responder(res, 200, resultado);
    } catch (error) {
        console.error("Erro interno em /api/generate-news:", error);
        return responder(res, 500, { error: "Ocorreu um erro interno ao gerar a notícia." });
    }
}
