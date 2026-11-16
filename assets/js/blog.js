import { Client, TablesDB, Query } from "https://cdn.jsdelivr.net/npm/appwrite@29.2.0/+esm";

const client = new Client()
    .setEndpoint("https://syd.cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const tablesDB = new TablesDB(client);
const newsGrid = document.getElementById("news-grid");
const categoryFilters = document.getElementById("category-filters");
const searchInput = document.getElementById("news-search");
const newsCount = document.getElementById("news-count");

let todasNoticias = [];
let categoriaAtiva = "Todas";
let termoPesquisa = "";

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
    const url = String(valor || "").trim();
    if (!url) return "";
    try {
        const parsed = new URL(url, window.location.origin);
        if (!["http:", "https:"].includes(parsed.protocol)) return "";
        return parsed.href;
    } catch {
        return "";
    }
}

function criarFiltros() {
    if (!categoryFilters) return;
    const categorias = [...new Set(
        todasNoticias.map(n => String(n.categoria || "").trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt"));

    categoryFilters.innerHTML = [
        '<button class="category-filter active" type="button" data-category="Todas">Todas</button>',
        ...categorias.map(categoria =>
            `<button class="category-filter" type="button" data-category="${escaparHTML(categoria)}">${escaparHTML(categoria)}</button>`
        )
    ].join("");

    categoryFilters.querySelectorAll(".category-filter").forEach(botao => {
        botao.addEventListener("click", () => {
            categoriaAtiva = botao.dataset.category || "Todas";
            categoryFilters.querySelectorAll(".category-filter").forEach(item =>
                item.classList.toggle("active", item === botao)
            );
            mostrarNoticias();
        });
    });
}

function obterNoticiasFiltradas() {
    return todasNoticias.filter(noticia => {
        const correspondeCategoria = categoriaAtiva === "Todas" ||
            String(noticia.categoria || "").trim() === categoriaAtiva;

        const texto = [
            noticia.titulo, noticia.resumo, noticia.conteudo, noticia.categoria
        ].join(" ").toLocaleLowerCase("pt");
        const correspondePesquisa = !termoPesquisa || texto.includes(termoPesquisa);

        return correspondeCategoria && correspondePesquisa;
    });
}

function mostrarNoticias() {
    if (!newsGrid) return;
    const noticias = obterNoticiasFiltradas();

    if (newsCount) {
        newsCount.textContent = noticias.length === 1
            ? "1 notícia encontrada"
            : `${noticias.length} notícias encontradas`;
    }

    if (!noticias.length) {
        newsGrid.innerHTML = `
            <div class="news-state">
                <i class="fa-regular fa-newspaper" aria-hidden="true"></i>
                <h3>Nenhuma notícia encontrada</h3>
                <p>Tente outra pesquisa ou selecione uma categoria diferente.</p>
                <button type="button" class="news-reset">Limpar filtros</button>
            </div>`;
        newsGrid.querySelector(".news-reset")?.addEventListener("click", () => {
            categoriaAtiva = "Todas";
            termoPesquisa = "";
            if (searchInput) searchInput.value = "";
            criarFiltros();
            mostrarNoticias();
        });
        return;
    }

    newsGrid.innerHTML = noticias.map(noticia => {
        const id = encodeURIComponent(String(noticia.$id || ""));
        const titulo = escaparHTML(noticia.titulo || "Notícia sem título");
        const resumoOriginal = String(noticia.resumo || noticia.conteudo || "").trim();
        const resumo = escaparHTML(resumoOriginal.length > 170
            ? resumoOriginal.slice(0, 167).trimEnd() + "..."
            : resumoOriginal);
        const imagem = urlImagemSegura(noticia.imagem_url);
        const media = imagem
            ? `<img src="${escaparHTML(imagem)}" alt="${titulo}" loading="lazy">`
            : '<div class="news-image-placeholder"><i class="fa-regular fa-image" aria-hidden="true"></i><span>KIKIAME</span></div>';

        return `
            <article class="news-card">
                <a class="news-card-image" href="noticia.html?id=${id}" aria-label="Ler: ${titulo}">
                    ${media}
                    <span class="news-category">${escaparHTML(noticia.categoria || "Geral")}</span>
                </a>
                <div class="news-card-content">
                    <span class="news-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escaparHTML(formatarData(noticia.data_publicacao))}</span>
                    <h3><a href="noticia.html?id=${id}">${titulo}</a></h3>
                    <p>${resumo || "Leia esta publicação para conhecer todos os detalhes."}</p>
                    <a class="news-read-more" href="noticia.html?id=${id}">Ler notícia <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                </div>
            </article>`;
    }).join("");
}

async function carregarNoticias() {
    if (!newsGrid) return;
    try {
        const resultado = await tablesDB.listRows({
            databaseId: "kikiame_db",
            tableId: "noticias",
            queries: [Query.orderDesc("data_publicacao"), Query.limit(100)]
        });

        todasNoticias = (resultado.rows || []).filter(n => n && n.$id);
        criarFiltros();
        mostrarNoticias();
    } catch (error) {
        console.error("Erro ao carregar notícias do Appwrite:", error);
        if (newsCount) newsCount.textContent = "Não foi possível obter as publicações.";
        newsGrid.innerHTML = `
            <div class="news-state news-error">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                <h3>Não foi possível carregar as notícias</h3>
                <p>Verifique a ligação e tente novamente dentro de alguns instantes.</p>
                <button type="button" class="news-retry">Tentar novamente</button>
            </div>`;
        newsGrid.querySelector(".news-retry")?.addEventListener("click", carregarNoticias);
    }
}

searchInput?.addEventListener("input", () => {
    termoPesquisa = searchInput.value.trim().toLocaleLowerCase("pt");
    mostrarNoticias();
});

carregarNoticias();
