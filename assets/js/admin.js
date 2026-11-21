import {
    Client,
    Account,
    Teams,
    TablesDB,
    Storage,
    ID
} from "https://cdn.jsdelivr.net/npm/appwrite@29.2.0/+esm";

const client = new Client()
    .setEndpoint("https://syd.cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const account = new Account(client);
const teams = new Teams(client);
const tablesDB = new TablesDB(client);
const storage = new Storage(client);

document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("form-noticia");
    const mensagem = document.getElementById("mensagem");
    const escolhaMetodo = document.getElementById("escolha-metodo");
    const painelIA = document.getElementById("gerador-ia");
    const botaoManual = document.getElementById("modo-manual");
    const botaoIA = document.getElementById("modo-ia");
    const botaoGerar = document.getElementById("gerar-noticia");

    if (!formulario || !mensagem) return;

    const mostrarMensagem = (texto, tipo = "") => {
        mensagem.textContent = texto;
        mensagem.className = tipo;
    };

    const bloquearAcesso = (texto) => {
        mostrarMensagem(texto, "message-error");
        document.querySelectorAll("#escolha-metodo button, #gerador-ia button, #form-noticia button")
            .forEach(elemento => elemento.disabled = true);
    };

    let utilizador;
    try {
        utilizador = await account.get();
    } catch (error) {
        window.location.replace("login.html");
        return;
    }

    try {
        const resultado = await teams.listMemberships({ teamId: "administradores" });
        const membershipAdmin = (resultado.memberships || []).find(
            membership =>
                membership.userId === utilizador.$id &&
                membership.confirm === true &&
                Array.isArray(membership.roles) &&
                membership.roles.includes("admin")
        );

        if (!membershipAdmin) {
            bloquearAcesso("Acesso negado. Apenas administradores autorizados podem publicar notícias.");
            return;
        }
    } catch (error) {
        console.error("Falha ao validar o papel administrativo:", error);
        bloquearAcesso("Não foi possível confirmar as permissões. Tenta novamente mais tarde.");
        return;
    }

    const mostrarEscolha = () => {
        escolhaMetodo.hidden = false;
        painelIA.hidden = true;
        formulario.hidden = true;
        mostrarMensagem("");
    };

    botaoManual.addEventListener("click", () => {
        escolhaMetodo.hidden = true;
        painelIA.hidden = true;
        formulario.hidden = false;
        mostrarMensagem("");
    });

    botaoIA.addEventListener("click", () => {
        escolhaMetodo.hidden = true;
        painelIA.hidden = false;
        formulario.hidden = true;
        mostrarMensagem("");
        document.getElementById("tema-ia").focus();
    });

    document.getElementById("voltar-metodos").addEventListener("click", mostrarEscolha);
    document.getElementById("trocar-metodo").addEventListener("click", mostrarEscolha);

    botaoGerar.addEventListener("click", async () => {
        const tema = document.getElementById("tema-ia").value.trim();
        const contexto = document.getElementById("contexto-ia").value.trim();
        const imagemIA = document.getElementById("imagem-ia");
        const ficheirosImagem = Array.from(imagemIA.files || []);
        const tiposImagem = ["image/jpeg", "image/png", "image/webp", "image/gif"];

        if (tema.length > 180 || (tema.length > 0 && tema.length < 5)) {
            mostrarMensagem("O tema deve ter entre 5 e 180 caracteres.", "message-error");
            document.getElementById("tema-ia").focus();
            return;
        }
        if (!tema && ficheirosImagem.length === 0) {
            mostrarMensagem("Envia uma imagem ou indica o tema da notícia.", "message-error");
            imagemIA.focus();
            return;
        }
        if (ficheirosImagem.length > 4) {
            mostrarMensagem("Podes selecionar no máximo 4 imagens.", "message-error");
            return;
        }
        if (ficheirosImagem.some(arquivo => !tiposImagem.includes(arquivo.type))) {
            mostrarMensagem("Formato não suportado. Usa JPG, PNG, WebP ou GIF.", "message-error");
            return;
        }
        if (ficheirosImagem.some(arquivo => arquivo.size > 700 * 1024)) {
            mostrarMensagem("Cada imagem para análise deve ter no máximo 700 KB.", "message-error");
            return;
        }
        if (ficheirosImagem.reduce((total, arquivo) => total + arquivo.size, 0) > 2.5 * 1024 * 1024) {
            mostrarMensagem("O conjunto das imagens não pode ultrapassar 2,5 MB.", "message-error");
            return;
        }

        botaoGerar.disabled = true;
        botaoGerar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gerar rascunho...';
        mostrarMensagem("A IA está a preparar a notícia. Aguarda...", "message-info");

        try {
            // O JWT temporário prova a sessão Appwrite sem expor uma chave de servidor.
            const jwtResult = await account.createJWT();
            const resposta = await fetch("/api/generate-news", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${jwtResult.jwt}`
                },
                body: JSON.stringify({
                    tema,
                    contexto,
                    imagens: await Promise.all(ficheirosImagem.map(arquivo => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve({ mimeType: arquivo.type, data: String(reader.result).split(",")[1] || "" });
                        reader.onerror = () => reject(new Error(`Não foi possível ler a imagem ${arquivo.name}.`));
                        reader.readAsDataURL(arquivo);
                    })))
                })
            });

            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) {
                throw new Error(dados.error || "Não foi possível gerar a notícia.");
            }

            document.getElementById("titulo").value = dados.titulo || "";
            document.getElementById("resumo").value = dados.resumo || "";
            document.getElementById("conteudo").value = dados.conteudo || "";
            document.getElementById("categoria").value = dados.categoria || "";

            // Reutiliza todas as imagens analisadas no formulário de publicação.
            if (ficheirosImagem.length) {
                const transferencia = new DataTransfer();
                ficheirosImagem.forEach(arquivo => transferencia.items.add(arquivo));
                document.getElementById("imagem").files = transferencia.files;
            }

            painelIA.hidden = true;
            formulario.hidden = false;
            mostrarMensagem("Rascunho gerado. Revê os factos, edita o texto e publica quando estiver pronto.", "message-success");
            document.getElementById("titulo").focus();
        } catch (erro) {
            console.error("Erro ao gerar notícia com IA:", erro);
            mostrarMensagem(erro.message || "Erro ao comunicar com o serviço de IA.", "message-error");
        } finally {
            botaoGerar.disabled = false;
            botaoGerar.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gerar rascunho';
        }
    });

    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();

        const titulo = document.getElementById("titulo").value.trim();
        const resumo = document.getElementById("resumo").value.trim();
        const conteudo = document.getElementById("conteudo").value.trim();
        const categoria = document.getElementById("categoria").value;
        const imagemInput = document.getElementById("imagem");

        if (!titulo || !conteudo) {
            mostrarMensagem("Preenche o título e o conteúdo.", "message-error");
            return;
        }

        const botaoPublicar = formulario.querySelector('button[type="submit"]');
        botaoPublicar.disabled = true;
        mostrarMensagem("A publicar notícia...", "message-info");

        const ficheirosIds = [];

        try {
            let imagemUrl = null;
            const imagensUrls = [];
            const arquivosSelecionados = Array.from(imagemInput.files || []);
            const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
            if (arquivosSelecionados.length > 4) throw new Error("Podes publicar no máximo 4 imagens por notícia.");
            for (const arquivo of arquivosSelecionados) {
                if (!tiposPermitidos.includes(arquivo.type)) throw new Error("Formato de imagem não suportado. Usa JPG, PNG, WebP ou GIF.");
                if (arquivo.size > 8 * 1024 * 1024) throw new Error(`A imagem ${arquivo.name} ultrapassa 8 MB.`);
                const ficheiroId = ID.unique();
                await storage.createFile({ bucketId: "noticias", fileId: ficheiroId, file: arquivo });
                ficheirosIds.push(ficheiroId);
                imagensUrls.push(storage.getFileView({ bucketId: "noticias", fileId: ficheiroId }).toString());
            }
            imagemUrl = imagensUrls[0] || null;

            await tablesDB.createRow({
                databaseId: "kikiame_db",
                tableId: "noticias",
                rowId: ID.unique(),
                data: {
                    titulo,
                    resumo: resumo || null,
                    conteudo,
                    categoria,
                    imagem_url: imagensUrls.length > 1
                        ? `${imagemUrl}#kikiame-gallery=${encodeURIComponent(JSON.stringify(imagensUrls))}`
                        : imagemUrl,
                    data_publicacao: new Date().toISOString()
                }
            });

            mostrarMensagem("Notícia publicada com sucesso! ✅", "message-success");
            formulario.reset();
            document.getElementById("tema-ia").value = "";
            document.getElementById("contexto-ia").value = "";
            document.getElementById("imagem-ia").value = "";
            mostrarEscolha();
            mostrarMensagem("Notícia publicada com sucesso! ✅", "message-success");
        } catch (erro) {
            console.error("Erro ao publicar notícia no Appwrite:", erro);

            for (const ficheiroId of ficheirosIds) {
                try {
                    await storage.deleteFile({ bucketId: "noticias", fileId: ficheiroId });
                } catch (erroRemocao) {
                    console.error("Não foi possível remover uma imagem não utilizada:", erroRemocao);
                }
            }

            mostrarMensagem(erro?.message || "Ocorreu um erro ao publicar a notícia.", "message-error");
        } finally {
            botaoPublicar.disabled = false;
        }
    });
});
