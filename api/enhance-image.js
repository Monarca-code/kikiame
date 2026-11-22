const APPWRITE_ENDPOINT = "https://syd.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6afaee080036fbc10c12";
const ADMIN_TEAM_ID = "administradores";

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
    if (!jwt) return responder(res, 401, { error: "Sessão não encontrada. Inicia sessão novamente." });

    const { GEMINI_API_KEY, APPWRITE_API_KEY } = process.env;
    if (!GEMINI_API_KEY || !APPWRITE_API_KEY) {
        return responder(res, 503, { error: "O serviço de melhoria de imagens não está configurado." });
    }

    try {
        const accountResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT_ID,
                "X-Appwrite-JWT": jwt
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!accountResponse.ok) return responder(res, 401, { error: "A sessão expirou. Inicia sessão novamente." });
        const utilizador = await accountResponse.json();

        const membershipsResponse = await fetch(
            `${APPWRITE_ENDPOINT}/teams/${encodeURIComponent(ADMIN_TEAM_ID)}/memberships?limit=100`,
            {
                headers: {
                    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
                    "X-Appwrite-Key": APPWRITE_API_KEY
                },
                signal: AbortSignal.timeout(10000)
            }
        );
        if (!membershipsResponse.ok) {
            console.error("Falha ao validar permissões para melhorar imagem:", membershipsResponse.status);
            return responder(res, 503, { error: "Não foi possível validar as permissões administrativas." });
        }

        const membershipsData = await membershipsResponse.json();
        const isAdmin = (membershipsData.memberships || []).some(membership =>
            membership.userId === utilizador.$id &&
            membership.confirm === true &&
            Array.isArray(membership.roles) &&
            membership.roles.includes("admin")
        );
        if (!isAdmin) return responder(res, 403, { error: "Apenas administradores autorizados podem melhorar imagens." });

        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const mimeType = String(body.mimeType || "");
        const data = String(body.data || "");
        if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(data) ||
            data.length > 1_000_000) {
            return responder(res, 400, { error: "Imagem inválida. Usa JPG, PNG ou WebP até 700 KB." });
        }

        const prompt = `Melhora tecnicamente esta fotografia para utilização num artigo jornalístico institucional. Devolve uma versão fotográfica natural, realista e fiel à imagem original. Corrige cuidadosamente exposição, balanço de brancos, contraste, nitidez e ruído; recupera detalhes sem criar halos nem aparência artificial. Mantém exatamente as pessoas, rostos, objetos, edifícios, enquadramento, posições, logótipos, símbolos e qualquer texto existente. Não acrescentes, removas, substituas ou inventes elementos. Não alteres identidade, vestuário, cenário, números, letras, marcas ou informação documental. Não transformes a fotografia numa ilustração, cartaz ou composição nova. Se um detalhe não puder ser recuperado, conserva-o em vez de o inventar. O resultado deve parecer a mesma fotografia, apenas com qualidade visual melhorada. Gera a imagem editada.`;

        const resposta = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(55000),
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data } }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        temperature: 0.2
                    }
                })
            }
        );

        const resultado = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            console.error("Gemini image enhancement error:", resposta.status, resultado?.error?.message || "sem detalhe");
            const status = [429, 500, 502, 503, 504].includes(resposta.status) ? 503 : 502;
            return responder(res, status, {
                error: resposta.status === 429
                    ? "O limite de utilização da IA foi atingido. Aguarda e tenta novamente."
                    : "A IA não conseguiu melhorar esta imagem. A imagem original continua disponível."
            });
        }

        const parts = resultado?.candidates?.[0]?.content?.parts || [];
        const imagemGerada = parts.find(part => part.inline_data?.data || part.inlineData?.data);
        const inline = imagemGerada?.inline_data || imagemGerada?.inlineData;
        if (!inline?.data) {
            return responder(res, 502, { error: "A IA não devolveu uma imagem melhorada. A imagem original foi mantida." });
        }

        return responder(res, 200, {
            mimeType: inline.mime_type || inline.mimeType || "image/png",
            data: inline.data
        });
    } catch (error) {
        console.error("Erro em /api/enhance-image:", error?.name || error?.message || error);
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            return responder(res, 504, { error: "A melhoria demorou demasiado tempo. Tenta novamente; a imagem original foi mantida." });
        }
        return responder(res, 500, { error: "Ocorreu um erro ao melhorar a imagem. A original foi mantida." });
    }
}