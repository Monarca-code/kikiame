import {
    Client,
    Account,
    Teams,
    TablesDB,
    Storage,
    ID
} from "https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm";

const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const account = new Account(client);
const teams = new Teams(client);
const tablesDB = new TablesDB(client);
const storage = new Storage(client);

document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("form-noticia");
    const mensagem = document.getElementById("mensagem");

    if (!formulario || !mensagem) return;

    // Exige sessão válida.
    try {
        await account.get();
    } catch (error) {
        window.location.href = "login.html";
        return;
    }

    // Exige que a conta pertença à equipa administrativa.
    try {
        const resultado = await teams.list({});
        const ehAdministrador = (resultado.teams || []).some(
            equipe => equipe.$id === "administradores"
        );

        if (!ehAdministrador) {
            mensagem.textContent = "Acesso reservado à equipa administradora.";
            formulario.querySelectorAll("input, textarea, select, button").forEach(
                elemento => elemento.disabled = true
            );
            return;
        }
    } catch (error) {
        console.error("Não foi possível validar a equipa:", error);
        mensagem.textContent = "Não foi possível validar as permissões da conta.";
        formulario.querySelectorAll("input, textarea, select, button").forEach(
            elemento => elemento.disabled = true
        );
        return;
    }

    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();

        const titulo = document.getElementById("titulo").value.trim();
        const resumo = document.getElementById("resumo").value.trim();
        const conteudo = document.getElementById("conteudo").value.trim();
        const categoria = document.getElementById("categoria").value;
        const imagemInput = document.getElementById("imagem");

        if (!titulo || !conteudo) {
            mensagem.textContent = "Preencha o título e o conteúdo.";
            return;
        }

        mensagem.textContent = "A publicar...";
        const botao = formulario.querySelector('button[type="submit"]');
        if (botao) botao.disabled = true;

        let ficheiroId = null;

        try {
            let imagemUrl = null;

            if (imagemInput.files && imagemInput.files.length > 0) {
                const arquivo = imagemInput.files[0];

                if (!arquivo.type.startsWith("image/")) {
                    throw new Error("Selecione um ficheiro de imagem válido.");
                }

                ficheiroId = ID.unique();

                await storage.createFile({
                    bucketId: "noticias",
                    fileId: ficheiroId,
                    file: arquivo
                });

                imagemUrl = storage.getFileView({
                    bucketId: "noticias",
                    fileId: ficheiroId
                }).toString();
            }

            await tablesDB.createRow({
                databaseId: "kikiame_db",
                tableId: "noticias",
                rowId: ID.unique(),
                data: {
                    titulo,
                    resumo: resumo || null,
                    conteudo,
                    categoria,
                    imagem_url: imagemUrl,
                    data_publicacao: new Date().toISOString()
                }
            });

            mensagem.textContent = "Notícia publicada com sucesso! ✅";
            formulario.reset();

        } catch (erro) {
            console.error("Erro ao publicar notícia no Appwrite:", erro);

            // Se a imagem foi enviada mas a notícia falhou, remove o ficheiro órfão.
            if (ficheiroId) {
                try {
                    await storage.deleteFile({
                        bucketId: "noticias",
                        fileId: ficheiroId
                    });
                } catch (erroRemocao) {
                    console.error("Não foi possível remover a imagem não utilizada:", erroRemocao);
                }
            }

            mensagem.textContent = erro?.message || "Ocorreu um erro ao publicar a notícia.";
        } finally {
            if (botao) botao.disabled = false;
        }
    });
});
