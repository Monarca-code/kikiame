import {
    Client,
    TablesDB,
    Query
} from "https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm";

const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const tablesDB = new TablesDB(client);

let todasNoticias = [];

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

async function carregarNoticias() {
    const newsGrid = document.getElementById("news-grid");
    if (!newsGrid) return;

    try {
        const resultado = await tablesDB.listRows({
            databaseId: "kikiame_db",
            tableId: "noticias",
            queries: [Query.orderDesc("data_publicacao")]
        });

        todasNoticias = resultado.rows || [];
        mostrarNoticias(todasNoticias);
    } catch (error) {
        console.error("Erro ao carregar notícias do Appwrite:", error);
        newsGrid.innerHTML = `
            <p class="news-error">
                Não foi possível carregar as notícias.
            </p>
        `;
    }
}

function mostrarNoticias(noticias) {
    const newsGrid = document.getElementById("news-grid");
    if (!newsGrid) return;

    if (!noticias.length) {
        newsGrid.innerHTML = `
            <p class="news-empty">
                Não existem notícias nesta categoria.
            </p>
        `;
        return;
    }

    newsGrid.innerHTML = noticias.map(noticia => {
        const dataPublicacao = noticia.data_publicacao
            ? new Date(noticia.data_publicacao).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            })
            : "";

        const imagem = noticia.imagem_url || "assets/images/news1.jpg";
        const resumo = noticia.resumo || noticia.conteudo || "";
        const id = noticia.$id;

        return `
            <article class="news-card">
                <div class="news-card-image">
                    <img src="${escaparHTML(imagem)}" alt="${escaparHTML(noticia.titulo)}">
                    <span class="news-category">
                        ${escaparHTML(noticia.categoria || "Empresa")}
                    </span>
                </div>

                <div class="news-card-content">
                    <span class="news-date">${escaparHTML(dataPublicacao)}</span>
                    <h3>${escaparHTML(noticia.titulo)}</h3>
                    <p>${escaparHTML(resumo)}</p>
                    <a href="noticia.html?id=${encodeURIComponent(id)}">
                        Ler notícia
                        <i class="fa-solid fa-arrow-right"></i>
                    </a>
                </div>
            </article>
        `;
    }).join("");
}

document.querySelectorAll(".category-filter").forEach(botao => {
    botao.addEventListener("click", () => {
        document.querySelectorAll(".category-filter").forEach(item => {
            item.classList.remove("active");
        });

        botao.classList.add("active");

        const categoriaSelecionada = botao.textContent.trim();

        if (categoriaSelecionada === "Todas") {
            mostrarNoticias(todasNoticias);
            return;
        }

        mostrarNoticias(
            todasNoticias.filter(noticia => noticia.categoria === categoriaSelecionada)
        );
    });
});

carregarNoticias();
