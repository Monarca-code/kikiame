import { Client, TablesDB } from "https://cdn.jsdelivr.net/npm/appwrite@29.2.0/+esm";

const client = new Client()
    .setEndpoint("https://syd.cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const tablesDB = new TablesDB(client);
const noticiaId = new URLSearchParams(window.location.search).get("id");
const container = document.getElementById("noticia-container");

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caracter]);
}

function formatarData(valor) {
    if (!valor) return "Data não disponível";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "Data não disponível";
    return data.toLocaleDateString("pt-PT", {
        day: "2-digit", month: "long", year: "numeric"
    });
}

function urlImagemSegura(valor) {
    if (!valor) return "";
    try {
        const url = new URL(String(valor), window.location.origin);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}

function apresentarErro(titulo, descricao) {
    container.innerHTML = `
        <div class="news-error">
            <h1>${escaparHTML(titulo)}</h1>
            <p>${escaparHTML(descricao)}</p>
            <a href="blog.html">Voltar ao blog</a>
        </div>`;
}

async function carregarNoticia() {
    if (!noticiaId || !container) {
        if (container) apresentarErro("Notícia não encontrada", "Nenhuma publicação foi selecionada.");
        return;
    }

    try {
        const noticia = await tablesDB.getRow({
            databaseId: "kikiame_db",
            tableId: "noticias",
            rowId: noticiaId
        });

        const titulo = escaparHTML(noticia.titulo || "Notícia KIKIAME");
        const resumo = escaparHTML(noticia.resumo || "");
        const conteudo = escaparHTML(noticia.conteudo || "");
        const imagem = urlImagemSegura(noticia.imagem_url);

        container.innerHTML = `
            <article class="single-news-content">
                ${imagem ? `<div class="single-news-image"><img src="${escaparHTML(imagem)}" alt="${titulo}"></div>` : ""}
                <div class="single-news-info">
                    <span class="news-category">${escaparHTML(noticia.categoria || "Geral")}</span>
                    <span class="news-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escaparHTML(formatarData(noticia.data_publicacao))}</span>
                </div>
                <h1>${titulo}</h1>
                ${resumo ? `<p class="single-news-summary">${resumo}</p>` : ""}
                <div class="single-news-text">${conteudo}</div>
                <a href="blog.html" class="back-news"><i class="fa-solid fa-arrow-left"></i> Voltar às notícias</a>
            </article>`;

        document.title = `${noticia.titulo || "Notícia"} | KIKIAME`;
        const description = document.querySelector('meta[name="description"]');
        if (description && noticia.resumo) description.content = String(noticia.resumo).slice(0, 155);
    } catch (error) {
        console.error("Erro ao carregar notícia do Appwrite:", error);
        apresentarErro("Não foi possível carregar esta notícia", "A publicação pode ter sido removida ou estar temporariamente indisponível.");
    }
}

carregarNoticia();
