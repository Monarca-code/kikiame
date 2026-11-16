import {
    Client,
    TablesDB,
    Query
} from "https://cdn.jsdelivr.net/npm/appwrite@29.2.0/+esm";

const client = new Client()
    .setEndpoint("https://syd.cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const tablesDB = new TablesDB(client);

const parametros = new URLSearchParams(window.location.search);
const noticiaId = parametros.get("id");
const container = document.getElementById("noticia-container");

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

async function carregarNoticia() {
    if (!noticiaId) {
        container.innerHTML = `
            <div class="news-error">
                <h1>Notícia não encontrada</h1>
                <p>Nenhuma notícia foi selecionada.</p>
                <a href="blog.html">Voltar ao blog</a>
            </div>
        `;
        return;
    }

    try {
        const resultado = await tablesDB.getRow({
            databaseId: "kikiame_db",
            tableId: "noticias",
            rowId: noticiaId
        });

        const noticia = resultado;

        const dataFormatada = noticia.data_publicacao
            ? new Date(noticia.data_publicacao).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            })
            : "";

        const imagemHTML = noticia.imagem_url
            ? `
                <div class="single-news-image">
                    <img src="${escaparHTML(noticia.imagem_url)}" alt="${escaparHTML(noticia.titulo)}">
                </div>
            `
            : "";

        container.innerHTML = `
            <article class="single-news-content">
                ${imagemHTML}

                <div class="single-news-info">
                    <span class="news-category">${escaparHTML(noticia.categoria || "Empresa")}</span>
                    <span class="news-date">${escaparHTML(dataFormatada)}</span>
                </div>

                <h1>${escaparHTML(noticia.titulo)}</h1>

                ${noticia.resumo
                    ? `<p class="single-news-summary">${escaparHTML(noticia.resumo)}</p>`
                    : ""
                }

                <div class="single-news-text">
                    ${noticia.conteudo || ""}
                </div>

                <a href="blog.html" class="back-news">
                    <i class="fa-solid fa-arrow-left"></i>
                    Voltar às notícias
                </a>
            </article>
        `;

        document.title = `${noticia.titulo} | KIKIAME`;

    } catch (error) {
        console.error("Erro ao carregar notícia do Appwrite:", error);

        container.innerHTML = `
            <div class="news-error">
                <h1>Erro ao carregar notícia</h1>
                <p>Não foi possível carregar esta notícia.</p>
                <a href="blog.html">Voltar às notícias</a>
            </div>
        `;
    }
}

carregarNoticia();
