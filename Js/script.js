const RAIZ = new URL("../", document.currentScript.src).href;
const API_URL = new URL("api/index.php?r=", RAIZ).href;

const PAGINAS_PRIVADAS = ["pags/logado.html", "pags/perfil.html", "pags/pedidos.html", "pags/enderecos.html"];
const PAGINAS_DE_ENTRADA = ["", "index.html", "pags/login.html", "pags/cadastro.html"];

function estaLogado() {
    try { return !!localStorage.getItem("token"); } catch (e) { return false; }
}
function lerCliente() {
    try { return JSON.parse(localStorage.getItem("cliente")) || {}; } catch (e) { return {}; }
}
function limparSessao() {
    ["token", "cliente", "endereco", "enderecoSel"].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
}
function deslogar() {
    limparSessao();
    window.location.href = RAIZ + "Pags/login.html";
}

(function guardarPaginas() {
    let caminho = location.pathname;
    try { caminho = decodeURIComponent(caminho); } catch (e) {}
    caminho = caminho.toLowerCase();
    const base = new URL(RAIZ).pathname.toLowerCase();
    if (caminho.indexOf(base) === 0) caminho = caminho.slice(base.length);
    if (estaLogado() && PAGINAS_DE_ENTRADA.includes(caminho)) location.replace(RAIZ + "Pags/logado.html");
    else if (!estaLogado() && PAGINAS_PRIVADAS.includes(caminho)) location.replace(RAIZ + "Pags/login.html");
})();

async function api(caminho, opcoes = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = "Bearer " + token;

    let resp;
    try {
        resp = await fetch(API_URL + caminho, { ...opcoes, headers });
    } catch (e) {
        throw new Error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    }
    const dados = resp.status === 204 ? null : await resp.json().catch(() => null);
    if (resp.status === 401 && token && caminho !== "/login") {
        limparSessao();
        window.location.href = RAIZ + "Pags/login.html";
    }
    if (!resp.ok) throw new Error((dados && dados.erro) || "Erro " + resp.status);
    return dados;
}

function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem("carrinho")) || []; }
    catch (e) { return []; }
}
function gravarCarrinho(lista) {
    try { localStorage.setItem("carrinho", JSON.stringify(lista)); } catch (e) {}
}

async function enviarPedido(lista) {
    if (lista.length === 0) { window.alert("Seu carrinho está vazio."); return null; }
    if (!localStorage.getItem("token")) {
        window.alert("Faça login para finalizar o pedido.");
        window.location.href = RAIZ + "Pags/login.html";
        return null;
    }

    const qtd = {};
    lista.forEach(i => qtd[i.id] = (qtd[i.id] || 0) + 1);
    const itens = Object.keys(qtd).map(id => ({ produtoId: Number(id), quantidade: qtd[id] }));

    const enderecos = await api("/enderecos");
    if (enderecos.length === 0) {
        window.alert("Cadastre um endereço de entrega para continuar.");
        window.location.href = RAIZ + "Pags/enderecos.html";
        return null;
    }
    let enderecoId = Number(localStorage.getItem("enderecoSel"));
    if (!enderecos.some(e => e.id === enderecoId)) enderecoId = enderecos[0].id;

    const r = await api("/pedidos", { method: "POST", body: JSON.stringify({ itens, enderecoId }) });
    gravarCarrinho([]);
    return r;
}

async function carregarSeletoresEndereco() {
    const selects = document.querySelectorAll("select.sel-endereco");
    if (selects.length === 0 || !estaLogado()) return;
    let lista = [];
    try { lista = await api("/enderecos"); } catch (e) { return; }

    const salvo = Number(localStorage.getItem("enderecoSel"));
    const atual = lista.some(e => e.id === salvo) ? salvo : (lista[0] ? lista[0].id : null);

    selects.forEach(sel => {
        sel.replaceChildren();
        if (lista.length === 0) {
            const o = document.createElement("option");
            o.value = "";
            o.textContent = "Nenhum endereço salvo";
            sel.appendChild(o);
            return;
        }
        lista.forEach(e => {
            const o = document.createElement("option");
            o.value = e.id;
            o.textContent = `${e.logradouro}, ${e.numero} - ${e.bairro}`;
            if (e.id === atual) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = () => {
            try { localStorage.setItem("enderecoSel", sel.value); } catch (er) {}
            selects.forEach(o => { o.value = sel.value; });
        };
    });
}

const login = document.getElementById("login");
if (login) {
    login.addEventListener("click", () => {
        window.location.href = RAIZ + "Pags/login.html";
    });
}

const trylogin = document.getElementById("formulario");

if (trylogin) {
    trylogin.addEventListener("submit", async function(event) {
        event.preventDefault();
        const email = document.getElementById("email").value;
        const senha = document.getElementById("senha").value;
        try {
            const r = await api("/login", { method: "POST", body: JSON.stringify({ email, senha }) });
            localStorage.setItem("token", r.token);
            localStorage.setItem("cliente", JSON.stringify(r.cliente));
            window.location.href = RAIZ + "Pags/logado.html";
        } catch (e) {
            window.alert(e.message);
        }
    });
}

const trycad = document.getElementById("formulario-cad");

if (trycad) {
    trycad.addEventListener("submit", async function(event) {
        event.preventDefault();
        const nome = document.getElementById("nome-cad").value.trim().replace(/\s+/g, " ");
        const email = document.getElementById("email-cad").value.trim().toLowerCase();
        const telefone = document.getElementById("telefone-cad").value;
        const senha = document.getElementById("senha-cad").value;
        const senha_rep = document.getElementById("senha-rep").value;

        if (nome.length < 3) { window.alert("Digite seu nome completo (mínimo 3 letras)."); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { window.alert("Digite um e-mail válido."); return; }
        const digitos = telefone.replace(/\D/g, "");
        if (digitos.length < 10 || digitos.length > 11) { window.alert("Telefone inválido. Use o formato (00) 00000-0000."); return; }
        if (senha.length < 6) { window.alert("A senha deve ter de 6 a 30 caracteres."); return; }
        if (senha !== senha_rep) {
            window.alert("Digite as Senhas Iguais");
            return;
        }
        try {
            await api("/cadastro", { method: "POST", body: JSON.stringify({ nome, email, telefone, senha }) });
            window.alert("Cadastro realizado! Faça login.");
            window.location.href = RAIZ + "Pags/login.html";
        } catch (e) {
            window.alert(e.message);
        }
    });
}

const MASCARAS = {
    telefone: v => {
        const d = v.replace(/\D/g, "").slice(0, 11);
        if (d.length === 0) return "";
        if (d.length <= 2) return "(" + d;
        if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
        if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
        return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    },
    cep: v => {
        const d = v.replace(/\D/g, "").slice(0, 8);
        return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    },
    numero: v => v.replace(/\D/g, "").slice(0, 6),
    nome: v => v.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "").replace(/\s{2,}/g, " ").replace(/^\s+/, ""),
    email: v => v.replace(/\s/g, "").toLowerCase()
};

function aplicarMascara(campo) {
    const fn = MASCARAS[campo.dataset.mascara];
    if (!fn) return;
    let v = fn(campo.value);
    if (campo.maxLength > 0) v = v.slice(0, campo.maxLength);
    if (v !== campo.value) campo.value = v;
}
document.querySelectorAll("[data-mascara]").forEach(campo => {
    campo.addEventListener("input", () => aplicarMascara(campo));
    campo.addEventListener("keydown", ev => {
        const tipo = campo.dataset.mascara;
        if ((tipo === "telefone" || tipo === "cep" || tipo === "numero") &&
            ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !/\d/.test(ev.key)) ev.preventDefault();
    });
    aplicarMascara(campo);
});

const cardapio = [
  { nome: "Mandioca com carne seca", preco: 42.0 },
  { nome: "Torresmo crocante", preco: 34.0 },
  { nome: "Calabresa acebolada", preco: 36.0 },
  { nome: "Bolinho de costela", preco: 40.0 },
  { nome: "Frango a passarinho", preco: 39.0 },
  { nome: "Feijoada completa", preco: 58.0 },
  { nome: "Parmegiana de frango", preco: 49.0 },
  { nome: "Tutu à mineira", preco: 52.0 },
  { nome: "Picanha na chapa", preco: 79.0 },
  { nome: "Feijão tropeiro", preco: 46.0 },
  { nome: "Chopp pilsen 300 ml", preco: 9.5 },
  { nome: "Cerveja long neck", preco: 12.0 },
  { nome: "Caipirinha de limão", preco: 18.0 },
  { nome: "Refrigerante lata", preco: 6.0 },
];

document.querySelectorAll("#cardapio .img_prod[data-foto]").forEach(caixa => {
    const sonda = new Image();
    sonda.onload = () => { caixa.style.backgroundImage = 'url("' + encodeURI(caixa.dataset.foto) + '")'; caixa.style.backgroundSize = "cover"; };
    sonda.onerror = () => { caixa.classList.add("sem-foto"); caixa.textContent = caixa.dataset.nome; };
    sonda.src = caixa.dataset.foto;
});

if (document.querySelector('#cardapio')) {
    const add = document.querySelectorAll('#cardapio .cad_it button');
    const container = document.getElementById("car");
    const carrinho = document.querySelector('#carrinho');
    const precoDisplay = document.getElementById("Total");
    const botaoComprar = document.querySelector('#Preço-e-Compra button');

    let prods = [];
    let ids = [];
    let nomes = [];

    function salvarCarrinho() {
        gravarCarrinho(ids.map((id, i) => ({ id: id, nome: nomes[i], preco: prods[i] })));
    }

    const logado = estaLogado();
    if (!logado) {
        carrinho.classList.add('bloqueado');
        const aviso = document.createElement('div');
        aviso.className = 'aviso-login';
        aviso.innerHTML = '<strong>Faça login para pedir</strong><span>Entre na sua conta para adicionar itens ao carrinho e finalizar o pedido.</span>' +
            '<a href="' + RAIZ + 'Pags/login.html">Entrar</a><a class="sec" href="' + RAIZ + 'Pags/cadastro.html">Criar conta</a>';
        carrinho.appendChild(aviso);
        document.querySelectorAll('#cardapio .cad_it button').forEach(b => { b.title = 'Faça login para pedir'; b.classList.add('desativado'); });
    }

    if (logado) lerCarrinho().forEach(it => {
        prods.push(it.preco); ids.push(it.id); nomes.push(it.nome);
        const li = document.createElement('li');
        li.classList.add('it-car');
        li.innerHTML = `<span>${it.nome}</span> <span>R$ ${Number(it.preco).toFixed(2)}</span><button class="Rem">Remover</button>`;
        container.appendChild(li);
    });
    precoDisplay.textContent = prods.reduce((a, b) => a + b, 0).toFixed(2);

    api("/cardapio").then(r => {
        const porNome = {};
        r.categorias.forEach(c => c.produtos.forEach(p => porNome[p.nome.trim().toLowerCase()] = p));
        cardapio.forEach(item => {
            const p = porNome[item.nome.toLowerCase()];
            if (p) { item.id = p.id; item.preco = p.preco; }
        });
    }).catch(e => console.warn("Cardápio da API indisponível:", e.message));

    add.forEach((botao, index) => {
        botao.addEventListener('click', () => {
            if (!estaLogado()) { window.alert("Faça login para adicionar itens ao carrinho."); window.location.href = RAIZ + "Pags/login.html"; return; }
            const produto = cardapio[index];

            if (!produto.id) {
                window.alert("Produto ainda não sincronizado com o sistema. Tente novamente.");
                return;
            }

            if (prods.length < 10) {
                prods.push(produto.preco);
                ids.push(produto.id);
                nomes.push(produto.nome);

                const novaLi = document.createElement('li');
                novaLi.classList.add('it-car');
                novaLi.innerHTML = `<span>${produto.nome}</span> <span>R$ ${produto.preco.toFixed(2)}</span><button class="Rem">Remover</button>`;
                container.appendChild(novaLi);

                const preco_at = parseFloat(precoDisplay.textContent) || 0;
                const total = preco_at + produto.preco;
                precoDisplay.textContent = total.toFixed(2);
                salvarCarrinho();
            } else {
                window.alert("Limite de Produtos Por Vez Atingido");
            }
        });
    });

    carrinho.addEventListener('click', (evento) => {
        const botaoRemover = evento.target.closest('.Rem');
        
        if (botaoRemover) {
            const itemCarrinho = botaoRemover.closest('.it-car');
            
            if (itemCarrinho) {
                const itensCarrinho = Array.from(container.querySelectorAll('.it-car'));
                const index = itensCarrinho.indexOf(itemCarrinho);

                if (index > -1) {
                    const preco_at = parseFloat(precoDisplay.textContent) || 0;
                    const precoRemover = prods[index] || 0;
                    const total = preco_at - precoRemover;
                    
                    precoDisplay.textContent = total >= 0 ? total.toFixed(2) : "0.00";

                    prods.splice(index, 1);
                    ids.splice(index, 1);
                    nomes.splice(index, 1);
                    salvarCarrinho();

                    itemCarrinho.remove();
                }
            }
        }
    });

    const caixaBusca = document.getElementById("busca-cardapio");
    const chips = document.querySelectorAll(".chip-cat");
    const semResultado = document.getElementById("sem-resultado");
    let categoriaAtiva = "todos";
    const semAcento = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

    function filtrarCardapio() {
        const q = semAcento(caixaBusca.value);
        let achados = 0;
        document.querySelectorAll("#cardapio .cat").forEach(sec => {
            const categoriaOk = categoriaAtiva === "todos" || categoriaAtiva === sec.dataset.cat;
            const rotulo = semAcento(sec.dataset.rotulo);
            const cards = sec.querySelectorAll(".cad_it");
            let visiveis = 0;
            cards.forEach(card => {
                const nome = semAcento(card.querySelector("h1").textContent.split("--")[0]);
                const ok = categoriaOk && (q === "" || nome.includes(q) || rotulo.includes(q));
                card.classList.toggle("oculto", !ok);
                if (ok) visiveis++;
            });
            achados += visiveis;
            const mostrar = categoriaOk && (visiveis > 0 || (cards.length === 0 && q === ""));
            sec.classList.toggle("oculto", !mostrar);
        });
        const nada = achados === 0 && (q !== "" || categoriaAtiva === "petiscos" || categoriaAtiva === "bebidas");
        semResultado.classList.toggle("oculto", !nada);
    }

    caixaBusca.addEventListener("input", filtrarCardapio);
    chips.forEach(chip => chip.addEventListener("click", () => {
        categoriaAtiva = chip.dataset.cat;
        chips.forEach(c => c.classList.toggle("ativo", c === chip));
        filtrarCardapio();
    }));

    if (botaoComprar) {
        const sel = document.createElement("select");
        sel.className = "sel-endereco";
        const gerenciar = document.createElement("a");
        gerenciar.href = RAIZ + "Pags/enderecos.html";
        gerenciar.className = "link-enderecos";
        gerenciar.textContent = "Gerenciar endereços";
        const bloco = document.createElement("div");
        bloco.className = "end-carrinho";
        bloco.append(sel, gerenciar);
        const barra = botaoComprar.parentElement;
        barra.parentElement.insertBefore(bloco, barra);

        botaoComprar.addEventListener('click', async () => {
            if (!estaLogado()) { window.alert("Faça login para finalizar o pedido."); window.location.href = RAIZ + "Pags/login.html"; return; }
            try {
                const r = await enviarPedido(ids.map((id, i) => ({ id: id, nome: nomes[i], preco: prods[i] })));
                if (!r) return;
                window.alert(`Pedido #${r.pedidoId} realizado! Total: R$ ${Number(r.total).toFixed(2)}`);
                prods = []; ids = []; nomes = [];
                container.querySelectorAll('.it-car').forEach(li => li.remove());
                precoDisplay.textContent = "0.00";
            } catch (e) {
                window.alert(e.message);
            }
        });
    }
}

if (document.getElementById('carrinho-flutuante')) {
    const painel = document.getElementById('carrinho-flutuante');
    const abrir = document.getElementById('btn-carrinho');
    const fechar = document.getElementById('fechar-carrinho');
    const lista = document.getElementById('cf-lista');
    const total = document.getElementById('cf-total');
    const qtd = document.getElementById('qtd-carrinho');
    const comprar = document.getElementById('cf-comprar');

    function desenhar() {
        const itens = lerCarrinho();
        lista.innerHTML = '';
        if (itens.length === 0) {
            lista.innerHTML = '<li class="cf-vazio">Carrinho vazio</li>';
        }
        itens.forEach((it, i) => {
            const li = document.createElement('li');
            const nome = document.createElement('span');
            nome.className = 'cf-nome';
            nome.textContent = it.nome;
            const preco = document.createElement('span');
            preco.textContent = 'R$ ' + Number(it.preco).toFixed(2);
            const rem = document.createElement('button');
            rem.className = 'cf-remover';
            rem.type = 'button';
            rem.textContent = '✕';
            rem.addEventListener('click', () => {
                const atual = lerCarrinho();
                atual.splice(i, 1);
                gravarCarrinho(atual);
                desenhar();
            });
            li.append(nome, preco, rem);
            lista.appendChild(li);
        });
        total.textContent = itens.reduce((a, it) => a + Number(it.preco), 0).toFixed(2);
        qtd.textContent = itens.length;
    }

    abrir.addEventListener('click', () => { painel.hidden = !painel.hidden; desenhar(); });
    fechar.addEventListener('click', () => { painel.hidden = true; });
    window.addEventListener('storage', desenhar);

    comprar.addEventListener('click', async () => {
        try {
            const r = await enviarPedido(lerCarrinho());
            if (!r) return;
            window.alert(`Pedido #${r.pedidoId} realizado! Total: R$ ${Number(r.total).toFixed(2)}`);
            desenhar();
        } catch (e) {
            window.alert(e.message);
        }
    });

    desenhar();
}

(function injetarCssAvatar() {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = RAIZ + "Css/avatar.css";
    document.head.appendChild(l);
})();

function criarAvatar() {
    const c = lerCliente();
    const wrap = document.createElement("div");
    wrap.className = "avatar-menu";

    const link = document.createElement("a");
    link.href = RAIZ + "Pags/perfil.html";
    link.className = "avatar-link";
    link.title = "Meu perfil";
    if (c.foto) {
        const img = document.createElement("img");
        img.src = c.foto;
        img.alt = "Foto do perfil";
        link.appendChild(img);
    } else {
        const ph = document.createElement("span");
        ph.textContent = "👤";
        link.appendChild(ph);
    }

    const drop = document.createElement("div");
    drop.className = "avatar-drop";
    const ends = document.createElement("a");
    ends.href = RAIZ + "Pags/enderecos.html";
    ends.textContent = "Meus endereços";
    const sair = document.createElement("a");
    sair.href = "#";
    sair.textContent = "Deslogar";
    sair.addEventListener("click", (e) => { e.preventDefault(); deslogar(); });
    const tema = document.createElement("a");
    tema.href = "#";
    tema.textContent = window.rotuloTema ? window.rotuloTema() : "Modo escuro";
    tema.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.alternarTema) { window.alternarTema(); tema.textContent = window.rotuloTema(); }
    });
    drop.append(ends, tema, sair);

    wrap.append(link, drop);
    return wrap;
}

function redesenharAvatares() {
    document.querySelectorAll(".avatar-menu").forEach(el => el.replaceWith(criarAvatar()));
}

function montarAvatarNoMenu() {
    if (!estaLogado()) return;
    const header = document.querySelector("header");
    if (!header) return;

    header.querySelectorAll('a.nav-txt[href$="perfil.html"]').forEach(a => {
        const li = a.closest("li");
        if (li) li.remove();
    });

    if (!header.querySelector('a.nav-txt[href$="pedidos.html"]')) {
        const ul = header.querySelector("ul");
        if (ul) {
            const liPed = document.createElement("li");
            const aPed = document.createElement("a");
            aPed.className = "nav-txt";
            aPed.href = RAIZ + "Pags/pedidos.html";
            aPed.textContent = "Pedidos";
            liPed.appendChild(aPed);
            const liLogin = document.getElementById("login") ? document.getElementById("login").closest("li") : null;
            if (liLogin) ul.insertBefore(liPed, liLogin); else ul.appendChild(liPed);
        }
    }

    const slot = document.getElementById("slot-avatar");
    const botaoLogin = document.getElementById("login");
    if (slot) {
        slot.replaceChildren(criarAvatar());
    } else if (botaoLogin) {
        const li = botaoLogin.closest("li");
        const novo = document.createElement("li");
        novo.className = "menu-avatar-li";
        novo.appendChild(criarAvatar());
        if (li) li.replaceWith(novo);
    }
}

async function atualizarPerfilDoServidor() {
    if (!estaLogado()) return;
    try {
        const p = await api("/perfil");
        const c = lerCliente();
        localStorage.setItem("cliente", JSON.stringify({ ...c, id: p.id, nome: p.nome, email: p.email, foto: p.foto }));
        redesenharAvatares();
    } catch (e) {  }
}

montarAvatarNoMenu();
atualizarPerfilDoServidor();
carregarSeletoresEndereco();

function redimensionarImagem(arquivo, tamanho) {
    return new Promise((ok, erro) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => {
            const lado = Math.min(img.width, img.height);
            const sx = (img.width - lado) / 2;
            const sy = (img.height - lado) / 2;
            const cv = document.createElement("canvas");
            cv.width = cv.height = tamanho;
            cv.getContext("2d").drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
            URL.revokeObjectURL(url);
            ok(cv.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("imagem inválida")); };
        img.src = url;
    });
}

if (document.getElementById("formulario-perfil")) {
    const form = document.getElementById("formulario-perfil");
    const nome = document.getElementById("perfil-nome");
    const email = document.getElementById("perfil-email");
    const tel = document.getElementById("perfil-telefone");
    const caixaFoto = document.getElementById("avatar");
    const arquivo = document.getElementById("perfil-foto");
    const botaoFoto = document.getElementById("btn-foto");
    let fotoNova;

    function mostrarFoto(src) {
        caixaFoto.replaceChildren();
        if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.alt = "Foto do perfil";
            caixaFoto.appendChild(img);
        } else {
            caixaFoto.textContent = "👤";
        }
    }

    const c = lerCliente();
    nome.value = c.nome || "";
    email.value = c.email || "";
    mostrarFoto(c.foto);

    api("/perfil").then(p => {
        nome.value = p.nome || "";
        email.value = p.email || "";
        tel.value = p.telefone || "";
        aplicarMascara(tel);
        mostrarFoto(p.foto);
    }).catch(e => window.alert(e.message));

    botaoFoto.addEventListener("click", () => arquivo.click());
    arquivo.addEventListener("change", () => {
        const f = arquivo.files[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) { window.alert("Escolha um arquivo de imagem."); return; }
        redimensionarImagem(f, 256)
            .then(d => { fotoNova = d; mostrarFoto(d); })
            .catch(() => window.alert("Não foi possível ler essa imagem."));
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const digTel = tel.value.replace(/\D/g, "");
        if (digTel.length !== 0 && digTel.length < 10) { window.alert("Telefone inválido. Use o formato (00) 00000-0000."); return; }
        const corpo = { nome: nome.value.trim(), telefone: tel.value };
        if (fotoNova !== undefined) corpo.foto = fotoNova;
        try {
            await api("/perfil", { method: "POST", body: JSON.stringify(corpo) });
            const atual = lerCliente();
            atual.nome = nome.value.trim();
            if (fotoNova !== undefined) atual.foto = fotoNova;
            localStorage.setItem("cliente", JSON.stringify(atual));
            redesenharAvatares();
            window.alert("Perfil atualizado!");
        } catch (err) {
            window.alert(err.message);
        }
    });

    document.getElementById("sair").addEventListener("click", (e) => {
        e.preventDefault();
        deslogar();
    });
}

if (document.getElementById("form-endereco")) {
    const lista = document.getElementById("lista-enderecos");
    const form = document.getElementById("form-endereco");

    async function carregarEnderecos() {
        let dados;
        try { dados = await api("/enderecos"); }
        catch (e) { lista.textContent = e.message; return; }

        lista.replaceChildren();
        if (dados.length === 0) {
            const vazio = document.createElement("p");
            vazio.className = "vazio";
            vazio.textContent = "Você ainda não tem endereços salvos.";
            lista.appendChild(vazio);
            return;
        }
        dados.forEach(e => {
            const card = document.createElement("div");
            card.className = "end-card";
            const txt = document.createElement("span");
            txt.textContent = `${e.logradouro}, ${e.numero} - ${e.bairro} (CEP ${e.cep})`;
            const rem = document.createElement("button");
            rem.type = "button";
            rem.textContent = "Remover";
            rem.addEventListener("click", async () => {
                if (!window.confirm("Remover este endereço?")) return;
                try {
                    await api("/enderecos/" + e.id, { method: "DELETE" });
                    carregarEnderecos();
                } catch (err) { window.alert(err.message); }
            });
            card.append(txt, rem);
            lista.appendChild(card);
        });
    }

    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const cep = document.getElementById("end-cep").value.trim();
        if (!/^\d{5}-?\d{3}$/.test(cep)) { window.alert("CEP inválido. Use o formato 00000-000."); return; }
        const corpo = {
            logradouro: document.getElementById("end-logradouro").value,
            numero: document.getElementById("end-numero").value,
            bairro: document.getElementById("end-bairro").value,
            cep: cep
        };
        try {
            const novo = await api("/enderecos", { method: "POST", body: JSON.stringify(corpo) });
            try { localStorage.setItem("enderecoSel", String(novo.id)); } catch (e) {}
            form.reset();
            carregarEnderecos();
        } catch (err) { window.alert(err.message); }
    });

    carregarEnderecos();
}

if (document.getElementById("lista-pedidos")) {
    const ROTULOS = {
        pedido_feito: "Pedido feito", pago: "Pago", em_preparo: "Em preparo",
        em_rota: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado"
    };
    const caixa = document.getElementById("lista-pedidos");
    const dinheiro = v => "R$ " + Number(v).toFixed(2).replace(".", ",");

    async function carregarPedidos() {
        let dados;
        try { dados = await api("/pedidos"); }
        catch (e) { caixa.textContent = e.message; return; }

        caixa.replaceChildren();
        if (dados.length === 0) {
            const vazio = document.createElement("p");
            vazio.className = "vazio";
            vazio.textContent = "Você ainda não fez pedidos. ";
            const a = document.createElement("a");
            a.href = RAIZ + "Pags/cardapio.html";
            a.textContent = "Ver cardápio";
            vazio.appendChild(a);
            caixa.appendChild(vazio);
            return;
        }

        dados.forEach(p => {
            const card = document.createElement("article");
            card.className = "pedido-card";

            const topo = document.createElement("div");
            topo.className = "pedido-topo";
            const titulo = document.createElement("strong");
            titulo.textContent = "Pedido #" + p.id;
            const st = document.createElement("span");
            st.className = "status s-" + p.status;
            st.textContent = ROTULOS[p.status] || p.status;
            topo.append(titulo, st);

            const data = document.createElement("small");
            data.textContent = new Date(p.criadoEm).toLocaleString("pt-BR");

            const itens = document.createElement("ul");
            p.itens.forEach(i => {
                const li = document.createElement("li");
                li.textContent = `${i.quantidade}x ${i.nome} — ${dinheiro(i.precoUnitario * i.quantidade)}`;
                itens.appendChild(li);
            });

            const end = document.createElement("p");
            end.textContent = "Entrega: " + p.endereco;
            const total = document.createElement("p");
            total.className = "pedido-total";
            total.textContent = "Total: " + dinheiro(p.total);

            card.append(topo, data, itens, end, total);

            if (p.status === "pedido_feito" || p.status === "pago") {
                const cancelar = document.createElement("button");
                cancelar.type = "button";
                cancelar.className = "pedido-cancelar";
                cancelar.textContent = "Cancelar pedido";
                cancelar.addEventListener("click", async () => {
                    if (!window.confirm("Cancelar o pedido #" + p.id + "?" + (p.status === "pago" ? "\n\nO pagamento será estornado." : ""))) return;
                    cancelar.disabled = true;
                    try {
                        await api("/pedidos/" + p.id + "/cancelar", { method: "POST" });
                        carregarPedidos();
                    } catch (e) {
                        window.alert(e.message);
                        cancelar.disabled = false;
                        carregarPedidos();
                    }
                });
                card.appendChild(cancelar);
            } else if (p.status === "em_preparo") {
                const aviso = document.createElement("small");
                aviso.className = "pedido-aviso";
                aviso.textContent = "Para cancelar este pedido, fale com o restaurante.";
                card.appendChild(aviso);
            }
            caixa.appendChild(card);
        });
    }

    carregarPedidos();
    setInterval(carregarPedidos, 15000);
}

const PROMOCOES = [
    null,
    { linha: "Bom de verdade,", titulo: "CHOPP GELADO!", lista: ["Pilsen 300 ml", "Bem gelado", "Com os amigos"], img: RAIZ + "_Imgs/Chopp pilsen 300 ml.webp" },
    { linha: "Refrescante e", titulo: "CAIPIRINHA!", lista: ["Limão fresco", "Bem geladinha", "Do jeito da casa"], img: RAIZ + "_Imgs/Caipirinha de limão.webp" },
    { linha: "Pra dividir na mesa:", titulo: "PETISCOS!", lista: ["Torresmo crocante", "Mandioca com carne seca", "Bolinho de costela"], img: RAIZ + "_Imgs/Torresmo crocante.webp" },
    { linha: "O gosto de boteco,", titulo: "SABOR MINEIRO!", lista: ["Frango a passarinho", "Calabresa acebolada", "Cerveja long neck"], img: RAIZ + "_Imgs/Frango a passarinho.webp" }
];

if (document.getElementById("img-banner")) {
    const fontes = document.createElement("link");
    fontes.rel = "stylesheet";
    fontes.href = "https://fonts.googleapis.com/css2?family=Caveat+Brush&family=Permanent+Marker&display=swap";
    document.head.appendChild(fontes);

    const palco = document.getElementById("img-banner");
    const miniaturas = document.querySelectorAll("#Preview-Carocel .Preview");
    const slides = [];

    PROMOCOES.forEach((p, i) => {
        const miniatura = miniaturas[i];
        if (!p) {
            slides.push(null);
            if (miniatura) {
                miniatura.style.backgroundImage = 'url("' + RAIZ + '_Imgs/image.png")';
                miniatura.style.backgroundSize = "cover";
                miniatura.style.backgroundPosition = "center";
            }
            return;
        }
        const url = 'url("' + encodeURI(p.img) + '")';
        const slide = document.createElement("div");
        slide.className = "slide";

        const foto = document.createElement("div");
        foto.className = "slide-foto";
        foto.style.backgroundImage = url;

        const linha = document.createElement("span");
        linha.className = "slide-linha";
        linha.textContent = p.linha;
        const titulo = document.createElement("h2");
        titulo.textContent = p.titulo;

        const lista = document.createElement("ul");
        lista.className = "slide-lista";
        p.lista.forEach(t => { const li = document.createElement("li"); li.textContent = t; lista.appendChild(li); });

        const frase = document.createElement("span");
        frase.className = "slide-frase";
        frase.textContent = "Mais sabor no seu dia!";

        slide.append(foto, linha, titulo, lista, frase);
        palco.appendChild(slide);
        slides.push(slide);

        if (miniatura) {
            miniatura.style.backgroundImage = url;
            miniatura.style.backgroundSize = "cover";
            miniatura.style.backgroundPosition = "center";
        }
    });

    let atual = 0;
    let relogio = null;

    function mostrar(i) {
        atual = (i + PROMOCOES.length) % PROMOCOES.length;
        slides.forEach((s, k) => { if (s) s.classList.toggle("ativo", k === atual); });
        palco.classList.toggle("com-slide", slides[atual] !== null);
    }
    function parar() { if (relogio) { clearInterval(relogio); relogio = null; } }
    function iniciar() {
        parar();
        relogio = setInterval(() => mostrar(atual + 1), 5000);
    }

    miniaturas.forEach((m, k) => m.addEventListener("click", () => { mostrar(k); iniciar(); }));
    palco.addEventListener("mouseenter", parar);
    palco.addEventListener("mouseleave", iniciar);

    mostrar(0);
    iniciar();
}
