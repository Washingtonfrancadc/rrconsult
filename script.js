const SUPABASE_URL = "https://qbladisbgosgnaamarst.supabase.co";
const SUPABASE_KEY = "sb_publishable_cJPpyWnFxOrxMORm3ZHURA_bxgy4jWX";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Chave secreta para operações de admin (redefinir senha sem email)
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibGFkaXNiZ29zZ25hYW1hcnN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ4NDc5OCwiZXhwIjoyMDk3MDYwNzk4fQ.mMRrCX1XyUkIxwQO5nLs5WfiIsbLNFtocKqyXhawPeY";

let dadosDoAluno = { rotinasTreino: [], rotinasDieta: [] };
let bibliotecaCompleta = [];
let bibliotecaAlimentosCompleta = [];
let listaGlobalAlunosCompleta = [];
let alunoIdSelecionado = "";
let modoEdicaoAtivo = false;
let idExercicioComGifAberto = null;
let modoGerenciamentoBancoAtivo = false;
let arquivosFotos = {
  frente: null,
  lado_esq: null,
  costas: null,
  lado_dir: null,
};

let blocoAlvoParaAdicionarExercicio = "";
let dietaAlvoIndices = { diaIdx: null, refIdx: null };
let estadosAbasExpandidas = {};
let estadosRefeicoesExpandidas = {};
const AUTENTICACAO_ATIVA = true;
let feedbacksEvolucao = [];
let carrosselPaginaAtual = 0;
let carrosselAnguloAtual = "frente";
let carrosselLarguraCard = 0;

let currentUser = {
  authId: null,
  email: "",
  role: null,
  alunoId: null,
  trainerId: null,
  nome: "",
};
let loginEmailPending = "";
let loginEntity = null;

function normalizeEmail(value) {
  if (!value || typeof value !== "string") return "";
  // Remove espaços no início e no fim, espaços no meio, aspas e caracteres invisíveis
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/['"]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase();
}

function validarEmail(email) {
  // Regex simples mas eficaz para validar formato de email
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Variáveis de controle para o Drag and Drop
let blocoArrastadoIdx = null;
let exercicioArrastadoCoords = { blocoIdx: null, exIdx: null };
let diaArrastadoIdx = null;
let refeicaoArrastadaCoords = { diaIdx: null, refIdx: null };

// Listas globais estáticas para evitar recriação de arrays
const LISTA_SERIES = [
  "2",
  "3",
  "4",
  "5",
  "1 (Aquec.)",
  "2 (Aquec.)",
  "7 (FST-7)",
  "10 (GVT)",
];
const LISTA_REPS = [
  "8~12",
  "8~15",
  "10~15",
  "12~15",
  "20~25",
  "20~25s",
  "10-8-8",
  "12-10-8",
  "12-10-8-8",
  "15-12-10",
  "15-12-10-8",
  "20-15-12",
  "MÁX.",
];
const LISTA_DESCANSO = [
  "-",
  "30s",
  "45s",
  "60s",
  "90s",
  "120s",
  "45~60s",
  "120~180s",
];

// --- FUNÇÕES DE UPLOAD E EVOLUÇÃO ---
function capturarPreviewMultiplo(input, posicao) {
  const arquivo = input.files[0];
  if (!arquivo) return;

  arquivosFotos[posicao] = arquivo;

  const preview = document.getElementById("preview-" + posicao);
  const status = document.getElementById("status-" + posicao);

  if (preview) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(arquivo);
  }

  if (status) {
    status.textContent = arquivo.name;
  }
}

async function enviarFeedbackCompleto() {
  const btn = document.getElementById("btn-enviar-feedback");
  const texto = document.getElementById("feedback-texto").value.trim();

  const posicoes = ["frente", "lado_esq", "costas", "lado_dir"];

  // Verificar se todas as 4 fotos foram selecionadas
  const fotosFaltando = posicoes.filter((pos) => !arquivosFotos[pos]);
  if (fotosFaltando.length > 0) {
    return alert(
      "As 4 fotos sao obrigatorias. Faltando: " +
        fotosFaltando
          .map((p) => {
            const nomes = {
              frente: "Frente",
              lado_esq: "Lado Esquerdo",
              costas: "Costas",
              lado_dir: "Lado Direito",
            };
            return nomes[p];
          })
          .join(", "),
    );
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

  try {
    const alunoId =
      currentUser.role === "aluno" ? currentUser.alunoId : alunoIdSelecionado;
    if (!alunoId) throw new Error("Nenhum aluno selecionado.");

    const urls = {};

    for (const pos of posicoes) {
      const arquivo = arquivosFotos[pos];
      const ext = arquivo.name.split(".").pop();
      const caminho = alunoId + "/" + Date.now() + "_" + pos + "." + ext;
      const { error: uploadError } = await _supabase.storage
        .from("fotos-evolucao")
        .upload(caminho, arquivo, { upsert: false });
      if (uploadError) {
        throw new Error(
          "Erro ao enviar foto " + pos + ": " + uploadError.message,
        );
      }
      const { data: publicUrl } = _supabase.storage
        .from("fotos-evolucao")
        .getPublicUrl(caminho);
      urls[pos] = publicUrl.publicUrl;
    }

    const { error: insertError } = await _supabase
      .from("evolucao_feedbacks")
      .insert({
        aluno_id: alunoId,
        texto: texto || null,
        foto_frente: urls.frente,
        foto_lado_esq: urls.lado_esq,
        foto_costas: urls.costas,
        foto_lado_dir: urls.lado_dir,
      });
    if (insertError) throw insertError;

    alert("Feedback enviado com sucesso!");

    document.getElementById("feedback-texto").value = "";
    for (const pos of posicoes) {
      arquivosFotos[pos] = null;
      const preview = document.getElementById("preview-" + pos);
      if (preview) {
        preview.src = "";
        preview.style.display = "none";
      }
      const status = document.getElementById("status-" + pos);
      if (status) status.textContent = "Toque p/ selecionar";
    }
  } catch (err) {
    console.error("Erro ao enviar feedback:", err);
    alert("Erro ao enviar: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fa-solid fa-paper-plane"></i> Enviar Atualizacao';
  }
}

window.onload = async function () {
  await carregarBibliotecaDeExercicios();
  await carregarBibliotecaDeAlimentos();
  configureAbas();
  if (AUTENTICACAO_ATIVA) {
    await inicializarAuth();
  } else {
    mostrarTelaLogin(false);
    await carregarAlunosDoBanco();
  }
};

async function inicializarAuth() {
  if (!AUTENTICACAO_ATIVA) {
    mostrarTelaLogin(false);
    await carregarAlunosDoBanco();
    return;
  }

  // Detectar se veio de recovery (redefinição de senha via link do email)
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const type = hashParams.get("type");
  const isRecovery = type === "recovery";

  if (isRecovery) {
    // O Supabase SDK já processou o token e estabeleceu sessão de recovery
    const session = await _supabase.auth.getSession();
    if (session.data?.session) {
      mostrarTelaLogin(true);
      resetLoginSteps();
      document.getElementById("emailStep").style.display = "none";
      document.getElementById("reset-email-panel").style.display = "none";
      document.getElementById("reset-senha-panel").style.display = "block";
      document.getElementById("modalResetSenha").style.display = "flex";
      window.location.hash = ""; // limpa o hash da URL
      return;
    }
  }

  const session = await _supabase.auth.getSession();
  console.log("inicializarAuth session", session);
  if (session.data?.session) {
    await iniciarSessaoAluno(session.data.session.user);
  } else {
    mostrarTelaLogin(true);
  }
}

function mostrarTelaLogin(ativar) {
  if (!AUTENTICACAO_ATIVA) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
    return;
  }
  document.getElementById("loginScreen").style.display = ativar
    ? "flex"
    : "none";
  document.getElementById("appContainer").style.display = ativar
    ? "none"
    : "block";
  if (ativar) {
    resetLoginSteps();
  }
}

function resetLoginSteps() {
  loginEmailPending = "";
  loginEntity = null;
  document.getElementById("emailStep").style.display = "flex";
  document.getElementById("passwordStep").style.display = "none";
  document.getElementById("setPasswordStep").style.display = "none";
  document.getElementById("loginHint").textContent =
    "Digite o e-mail cadastrado para continuar.";
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("set-password").value = "";
  document.getElementById("login-email-display").textContent = "";
  document.getElementById("set-password-email").textContent = "";
  document.getElementById("login-email-hidden").value = "";
  document.getElementById("login-email-hidden-set").value = "";
  document.getElementById("loginMessage").textContent = "";
}

function mostrarCriarSenha() {
  document.getElementById("passwordStep").style.display = "none";
  document.getElementById("setPasswordStep").style.display = "flex";
}

function aplicarTemaPorSexo(sexo) {
  document.body.classList.remove("sexo-masculino", "sexo-feminino");
  if (sexo === "Feminino") {
    document.body.classList.add("sexo-feminino");
  } else if (sexo === "Masculino") {
    document.body.classList.add("sexo-masculino");
  }
}

async function iniciarSessaoAluno(user) {
  if (!user) return mostrarTelaLogin(true);
  currentUser.authId = user.id;
  currentUser.email = normalizeEmail(user.email || "");
  currentUser.alunoId = null;
  currentUser.trainerId = null;

  console.log("iniciarSessaoAluno", {
    authId: currentUser.authId,
    email: currentUser.email,
  });
  const session = await _supabase.auth.getSession();
  console.log("iniciarSessaoAluno current session", session);

  let { data: aluno, error: alunoError } = await _supabase
    .from("alunos")
    .select("*")
    .eq("auth_id", currentUser.authId)
    .maybeSingle();
  if (alunoError) {
    console.warn("Erro ao carregar aluno por auth_id", alunoError);
  }

  if (!aluno && currentUser.email) {
    const result = await _supabase
      .from("alunos")
      .select("*")
      .ilike("email", currentUser.email)
      .maybeSingle();
    if (result.error) {
      console.warn("Erro ao buscar aluno por email", result.error);
    }
    aluno = result.data;
    if (aluno) {
      await _supabase
        .from("alunos")
        .update({ auth_id: currentUser.authId })
        .eq("id", aluno.id);
    }
  }

  if (aluno) {
    currentUser.alunoId = aluno.id;
    currentUser.nome = aluno.nome;
    currentUser.role = "aluno";
    aplicarTemaPorSexo(aluno.sexo);
    document.getElementById("loginMessage").textContent =
      `Logado como ${aluno.nome}`;
    await carregarDadosDoAlunoLogado();
    mostrarTelaLogin(false);
    return;
  }

  let { data: trainer, error: trainerError } = await _supabase
    .from("trainers")
    .select("*")
    .eq("auth_id", currentUser.authId)
    .maybeSingle();
  if (trainerError) {
    console.error("Erro ao consultar trainers:", trainerError);
  }

  if (!trainer && currentUser.email) {
    const result = await _supabase
      .from("trainers")
      .select("*")
      .ilike("email", currentUser.email)
      .maybeSingle();
    trainer = result.data;
    if (trainer) {
      await _supabase
        .from("trainers")
        .update({ auth_id: currentUser.authId })
        .eq("id", trainer.id);
    }
  }

  if (trainer) {
    currentUser.trainerId = trainer.id;
    currentUser.nome = trainer.nome || currentUser.email;
    currentUser.role = "treinador";
    aplicarTemaPorSexo(null); // remove tema de aluno
    document.getElementById("loginMessage").textContent =
      `Logado como treinador ${currentUser.nome}`;
    await carregarDadosDoTreinadorLogado();
    mostrarTelaLogin(false);
    return;
  }

  alert(
    "Nenhum aluno ou treinador encontrado com esse e-mail. Entre em contato com o administrador.",
  );
  await _supabase.auth.signOut();
  mostrarTelaLogin(true);
}

async function handleLogin() {
  const email = normalizeEmail(loginEmailPending);
  const password = document.getElementById("login-password").value;
  if (!email || !password) return alert("Preencha a senha.");

  const { data, error } = await _supabase.auth.signInWithPassword({
    email,
    password,
  });
  console.log("handleLogin result", { email, data, error });
  if (error) {
    if (
      error.message?.toLowerCase().includes("email not confirmed") ||
      error.message?.toLowerCase().includes("email not verified")
    ) {
      alert(
        "Email não confirmado. Verifique sua caixa de entrada (ou spam) e clique no link de confirmação enviado pela Monkey Consultoria.",
      );
      return;
    }
    if (error.message?.toLowerCase().includes("invalid login credentials")) {
      alert(
        "Senha incorreta. Tente novamente, use 'Redefinir Senha' se esqueceu, ou 'Criar senha' se nunca criou uma.",
      );
      return;
    }
    return alert(error.message);
  }

  const session = await _supabase.auth.getSession();
  console.log("handleLogin session after sign in", session);
  if (!session.data?.session) {
    return alert("Falha ao obter sessão. Atualize a página e tente novamente.");
  }

  await iniciarSessaoAluno(session.data.session.user);
}

async function handleEmailContinue() {
  const email = normalizeEmail(document.getElementById("login-email").value);
  if (!email) return alert("Digite um e-mail.");
  if (!validarEmail(email))
    return alert("E-mail inválido. Use um formato como: exemplo@dominio.com");

  let loginData = null;
  let entityType = null;

  const { data: aluno, error: alunoError } = await _supabase
    .from("alunos")
    .select("id, nome, email, auth_id")
    .ilike("email", email)
    .maybeSingle();

  if (alunoError) {
    console.error("Erro ao consultar aluno:", alunoError);
    return alert(
      "Não foi possível verificar o e-mail. Verifique a tabela de alunos.",
    );
  }

  if (aluno) {
    loginData = aluno;
    entityType = "aluno";
  } else {
    const { data: trainer, error: trainerError } = await _supabase
      .from("trainers")
      .select("id, nome, email, auth_id")
      .ilike("email", email)
      .maybeSingle();

    if (trainerError) {
      console.error("Erro ao consultar treinador:", trainerError);
      return alert(
        "Não foi possível verificar o e-mail. Verifique a tabela de treinadores.",
      );
    }
    if (trainer) {
      loginData = trainer;
      entityType = "trainer";
    }
  }

  if (!loginData) {
    console.warn("Nenhuma entidade retornada para login:", email);
    return alert(
      "E-mail não encontrado. Cadastre seu usuário ou peça ao administrador.",
    );
  }

  loginEmailPending = loginData.email;
  loginEntity = { type: entityType, record: loginData };

  document.getElementById("login-email-display").textContent = loginData.nome;
  document.getElementById("set-password-email").textContent = loginData.nome;
  document.getElementById("emailStep").style.display = "none";
  document.getElementById("loginHint").textContent = "";

  // Preenche campos de email ocultos (acessibilidade / autocomplete do navegador)
  document.getElementById("login-email-hidden").value = loginData.email;
  document.getElementById("login-email-hidden-set").value = loginData.email;

  // Sempre vai para a tela de LOGIN primeiro
  // O usuário escolhe: digitar senha, redefinir, ou criar senha
  console.log("→ Mostrando tela de LOGIN (passwordStep)");
  document.getElementById("passwordStep").style.display = "flex";
  document.getElementById("setPasswordStep").style.display = "none";
}

async function handleSetPassword() {
  const rawEmail =
    loginEmailPending ||
    document.getElementById("set-password-email").textContent;
  const email = normalizeEmail(rawEmail);
  const password = document.getElementById("set-password").value;
  if (!email || !password) return alert("Digite uma senha para continuar.");
  if (!validarEmail(email)) {
    return alert("E-mail inválido. Reinicie o processo com um e-mail válido.");
  }

  if (!loginEntity) {
    return alert("Entidade de login nao definida. Reinicie o fluxo de login.");
  }

  const btn = document.querySelector("#setPasswordStep .btn-alunos");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';
  }

  try {
    console.log("handleSetPassword - email:", email);

    // PRIMEIRO: tenta fazer login (usuário pode já existir no Auth)
    const { data: loginData, error: loginError } =
      await _supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (!loginError && loginData?.user?.id) {
      // Login OK! Usuário já existe no Auth e senha confere
      console.log("handleSetPassword - login OK, auth_id:", loginData.user.id);
      const authId = loginData.user.id;
      if (loginEntity.type === "trainer") {
        await _supabase
          .from("trainers")
          .update({ auth_id: authId })
          .eq("id", loginEntity.record.id);
      } else {
        await _supabase
          .from("alunos")
          .update({ auth_id: authId })
          .eq("id", loginEntity.record.id);
      }
      alert("Bem-vindo de volta!");
      window.location.reload();
      return;
    }

    // SEGUNDO: se login falhou, tenta criar conta nova
    console.log("handleSetPassword - login falhou, tentando signUp");
    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });

    if (error) {
      console.log("handleSetPassword - erro signUp:", error);

      // Se o erro é que já existe no Auth (422 ou mensagem)
      const jaExiste =
        error?.status === 422 ||
        error?.status === 400 ||
        error?.message?.toLowerCase().includes("already registered") ||
        error?.message?.toLowerCase().includes("already exists") ||
        error?.message?.toLowerCase().includes("user already") ||
        error?.message?.toLowerCase().includes("email address already");

      if (jaExiste) {
        // Tenta redefinir a senha direto via API de admin
        if (SERVICE_ROLE_KEY) {
          try {
            const headers = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              apikey: SERVICE_ROLE_KEY,
            };

            // Busca TODOS os usuários e encontra pelo email
            const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
              headers,
            });
            const usersData = await res.json();
            console.log(
              "Admin API - users encontrados:",
              usersData?.users?.length,
            );
            const existingUser = (usersData?.users || []).find(
              (u) => u.email?.toLowerCase() === email,
            );

            if (existingUser?.id) {
              // Atualiza a senha
              const updateRes = await fetch(
                `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`,
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({ password }),
                },
              );

              if (updateRes.ok) {
                alert("Senha redefinida com sucesso!");
                const { error: loginError } =
                  await _supabase.auth.signInWithPassword({
                    email,
                    password,
                  });
                if (!loginError) {
                  window.location.reload();
                  return;
                }
                document.getElementById("setPasswordStep").style.display =
                  "none";
                document.getElementById("passwordStep").style.display = "flex";
                return;
              }
            }
          } catch (e) {
            console.error("Erro ao usar admin API:", e);
          }
        }

        // Sem service_role — mostra mensagem
        alert(
          "Este email já possui senha cadastrada. Para redefinir sem email, cole a chave SERVICE_ROLE_KEY no código (Settings > API no Supabase).",
        );
        document.getElementById("setPasswordStep").style.display = "none";
        document.getElementById("passwordStep").style.display = "flex";
        return;
      }

      if (
        error?.status === 429 ||
        error?.message?.toLowerCase().includes("rate limit")
      ) {
        alert(
          "Muitas tentativas seguidas. Aguarde 1 minuto e tente novamente.",
        );
        return;
      }

      alert("Erro: " + (error.message || JSON.stringify(error)));
      return;
    }

    // SignUp funcionou! Novo usuário criado no Auth
    console.log("handleSetPassword - signUp OK, data:", data);

    if (data.user?.id) {
      const authId = data.user.id;
      if (loginEntity.type === "trainer") {
        await _supabase
          .from("trainers")
          .update({ auth_id: authId })
          .eq("id", loginEntity.record.id);
      } else {
        await _supabase
          .from("alunos")
          .update({ auth_id: authId })
          .eq("id", loginEntity.record.id);
      }

      if (data.session) {
        alert("Senha criada com sucesso! Bem-vindo.");
        window.location.reload();
        return;
      }
    }

    resetLoginSteps();
    alert("Conta criada! Enviamos um link de confirmação para " + email);
  } catch (err) {
    console.error("handleSetPassword - exceção:", err);
    alert("Erro inesperado: " + (err.message || JSON.stringify(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar';
    }
  }
}

// === FLUXO DE REDEFINIÇÃO DE SENHA ===

function mostrarModalRedefinirSenha() {
  const email = normalizeEmail(loginEmailPending);
  if (!email) return alert("Nenhum e-mail selecionado.");

  document.getElementById("reset-email-display").textContent = email;
  document.getElementById("reset-email-panel").style.display = "block";
  document.getElementById("reset-senha-panel").style.display = "none";
  document.getElementById("reset-nova-senha").value = "";
  document.getElementById("reset-confirmar-senha").value = "";
  document.getElementById("modalResetSenha").style.display = "flex";
}

function fecharModalResetSenha() {
  document.getElementById("modalResetSenha").style.display = "none";
}

async function enviarEmailRedefinirSenha() {
  const email = normalizeEmail(loginEmailPending);
  if (!email) return alert("E-mail não encontrado.");

  const btn = document.querySelector("#reset-email-panel .btn-alunos");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
  }

  const { error } = await _supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fa-solid fa-paper-plane"></i> Enviar e-mail de redefinição';
  }

  if (error) {
    return alert("Erro ao enviar e-mail: " + error.message);
  }

  fecharModalResetSenha();
  alert(
    `E-mail de redefinição enviado para ${email}! Verifique sua caixa de entrada e spam, depois clique no link recebido.`,
  );
}

async function handleResetPasswordConfirm() {
  const novaSenha = document.getElementById("reset-nova-senha").value;
  const confirmarSenha = document.getElementById("reset-confirmar-senha").value;

  if (!novaSenha) return alert("Digite a nova senha.");
  if (novaSenha !== confirmarSenha) return alert("As senhas não conferem.");
  if (novaSenha.length < 6)
    return alert("A senha deve ter no mínimo 6 caracteres.");

  const btn = document.querySelector("#reset-senha-panel .btn-salvar");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  }

  const { error } = await _supabase.auth.updateUser({ password: novaSenha });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Definir nova senha';
  }

  if (error) {
    return alert("Erro ao redefinir senha: " + error.message);
  }

  alert("Senha redefinida com sucesso! Faça login com sua nova senha.");
  await _supabase.auth.signOut();
  fecharModalResetSenha();
  resetLoginSteps();
}

async function handleLogout() {
  await _supabase.auth.signOut();
  currentUser = {
    authId: null,
    email: "",
    role: null,
    alunoId: null,
    trainerId: null,
    nome: "",
  };
  loginEmailPending = "";
  loginEntity = null;
  mostrarTelaLogin(true);
}

// === MUDAR SENHA (ALUNO LOGADO) ===

function abrirModalMudarSenha() {
  document.getElementById("mudar-senha-nova").value = "";
  document.getElementById("mudar-senha-confirmar").value = "";
  document.getElementById("modalMudarSenha").style.display = "flex";
}

function fecharModalMudarSenha() {
  document.getElementById("modalMudarSenha").style.display = "none";
}

async function handleMudarSenha() {
  const novaSenha = document.getElementById("mudar-senha-nova").value;
  const confirmarSenha = document.getElementById("mudar-senha-confirmar").value;

  if (!novaSenha) return alert("Digite a nova senha.");
  if (novaSenha !== confirmarSenha) return alert("As senhas não conferem.");
  if (novaSenha.length < 6)
    return alert("A senha deve ter no mínimo 6 caracteres.");

  const btn = document.querySelector("#modalMudarSenha .btn-salvar");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';
  }

  const { error } = await _supabase.auth.updateUser({ password: novaSenha });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar senha';
  }

  if (error) {
    return alert("Erro ao alterar senha: " + error.message);
  }

  alert("Senha alterada com sucesso!");
  fecharModalMudarSenha();
}

// === MUDAR E-MAIL (ALUNO LOGADO) ===

function abrirModalMudarEmail() {
  document.getElementById("mudar-email-atual").textContent =
    currentUser.email || "—";
  document.getElementById("mudar-email-novo").value = "";
  document.getElementById("mudar-email-confirmar").value = "";
  document.getElementById("mudar-email-senha").value = "";
  document.getElementById("modalMudarEmail").style.display = "flex";
}

function fecharModalMudarEmail() {
  document.getElementById("modalMudarEmail").style.display = "none";
}

async function handleMudarEmail() {
  const senhaAtual = document.getElementById("mudar-email-senha").value;
  const novoEmail = normalizeEmail(
    document.getElementById("mudar-email-novo").value,
  );
  const confirmarEmail = normalizeEmail(
    document.getElementById("mudar-email-confirmar").value,
  );

  if (!novoEmail) return alert("Digite o novo e-mail.");
  if (!validarEmail(novoEmail)) return alert("E-mail inválido.");
  if (novoEmail !== confirmarEmail) return alert("Os e-mails não conferem.");
  if (novoEmail === normalizeEmail(currentUser.email))
    return alert("O novo e-mail é igual ao atual.");
  if (!senhaAtual) return alert("Digite sua senha atual para confirmar.");

  const btn = document.querySelector("#modalMudarEmail .btn-salvar");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';
  }

  const emailAtual = normalizeEmail(currentUser.email);

  // Reautentica com a senha atual antes de alterar o e-mail
  const { error: reauthError } = await _supabase.auth.signInWithPassword({
    email: emailAtual,
    password: senhaAtual,
  });

  if (reauthError) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar e-mail';
    }
    return alert("Senha atual incorreta. Tente novamente.");
  }

  // Agora altera o e-mail no auth
  const { data, error } = await _supabase.auth.updateUser({
    email: novoEmail,
  });

  if (error) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar e-mail';
    }
    return alert(
      "Erro ao alterar e-mail: " +
        error.message +
        ". Verifique se o e-mail já não está em uso.",
    );
  }

  // Também atualiza o e-mail na tabela "alunos"
  if (currentUser.alunoId) {
    await _supabase
      .from("alunos")
      .update({ email: novoEmail })
      .eq("id", currentUser.alunoId);
  }

  // Atualiza no objeto local
  currentUser.email = novoEmail;

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar e-mail';
  }

  alert(
    "E-mail alterado com sucesso! Verifique sua caixa de entrada (inclusive spam) no novo e-mail para confirmar a alteração.",
  );
  fecharModalMudarEmail();
}

// --- FUNÇÃO AUXILIAR DE RENDERIZAÇÃO DE SELETORES (SCROLL) ---
function gerarSelectHtml(lista, valorAtual, onChangeStr) {
  const stringLogicaScroll = `event.preventDefault(); if(event.deltaY > 0) { if(this.selectedIndex < this.options.length - 1) { this.selectedIndex++; this.dispatchEvent(new Event('change')); } } else { if(this.selectedIndex > 0) { this.selectedIndex--; this.dispatchEvent(new Event('change')); } }`;
  return `<select class="input-inline" onwheel="${stringLogicaScroll}" style="background:#1f2937; color:white; border:1px solid #4b5563; cursor:ns-resize;" onchange="${onChangeStr}">
        ${lista.map((item) => `<option value="${item}" ${valorAtual == item ? "selected" : ""}>${item}</option>`).join("")}
    </select>`;
}

function gerarSelectExerciciosPorMusculo(valorAtual, onChangeStr) {
  let ag = {};
  bibliotecaCompleta.forEach((e) => {
    if (!ag[e.musculo]) ag[e.musculo] = [];
    ag[e.musculo].push(e);
  });
  const stringLogicaScroll = `event.preventDefault(); if(event.deltaY > 0) { if(this.selectedIndex < this.options.length - 1) { this.selectedIndex++; this.dispatchEvent(new Event('change')); } } else { if(this.selectedIndex > 0) { this.selectedIndex--; this.dispatchEvent(new Event('change')); } }`;
  let html = `<select class="input-inline" onwheel="${stringLogicaScroll}" style="background:#1f2937; color:white; border:1px solid #4b5563; cursor:ns-resize; max-width:180px;" onchange="${onChangeStr}">`;
  html += `<option value="">-- Selecione --</option>`;
  Object.keys(ag).forEach((musculo) => {
    html += `<optgroup label="${musculo}">`;
    ag[musculo].forEach((ex) => {
      const selected = ex.nome_exercicio === valorAtual ? "selected" : "";
      html += `<option value="${ex.nome_exercicio}" data-gif="${ex.gif_url}" ${selected}>${ex.nome_exercicio}</option>`;
    });
    html += `</optgroup>`;
  });
  html += `</select>`;
  return html;
}

function onChangeExercicioSelect(sel, bIdx, eIdx) {
  const opt = sel.options[sel.selectedIndex];
  dadosDoAluno.rotinasTreino[bIdx].exercicios[eIdx].nome = sel.value;
  dadosDoAluno.rotinasTreino[bIdx].exercicios[eIdx].gif_url = opt
    ? opt.getAttribute("data-gif")
    : "";
}

function onChangeExercicioSelect2(sel, bIdx, eIdx) {
  const opt = sel.options[sel.selectedIndex];
  dadosDoAluno.rotinasTreino[bIdx].exercicios[eIdx].nome2 = sel.value;
  dadosDoAluno.rotinasTreino[bIdx].exercicios[eIdx].gif_url2 = opt
    ? opt.getAttribute("data-gif")
    : "";
}

// --- FUNÇÕES DE BANCO / CARREGAMENTO ---
async function carregarAlunosDoBanco() {
  const session = await _supabase.auth.getSession();
  console.log("carregarAlunosDoBanco session", session);
  const { data: alunos, error } = await _supabase
    .from("alunos")
    .select("*")
    .order("nome");
  if (error) {
    console.error("Erro ao carregar lista de alunos:", error);
  }
  listaGlobalAlunosCompleta = alunos || [];
  console.log(
    "carregarAlunosDoBanco alunos count",
    listaGlobalAlunosCompleta.length,
  );
  const seletor = document.getElementById("selectAluno");
  if (listaGlobalAlunosCompleta.length > 0) {
    seletor.innerHTML = listaGlobalAlunosCompleta
      .map((a) => `<option value="${a.id}">${a.nome}</option>`)
      .join("");
    if (!alunoIdSelecionado)
      alunoIdSelecionado = listaGlobalAlunosCompleta[0].id;
    await puxarDadosDoAlunoDoBanco();
  }
}

async function carregarDadosDoAlunoLogado() {
  if (!currentUser.alunoId) return;
  alunoIdSelecionado = currentUser.alunoId;
  const seletor = document.getElementById("selectAluno");
  if (seletor) {
    seletor.value = alunoIdSelecionado;
    seletor.style.display = "none";
  }
  const painel = document.getElementById("painelAdmin");
  painel.style.display = "none";
  document.getElementById("nomeAlunoDisplay").textContent = currentUser.nome;

  refreshAuthUI();
  await puxarDadosDoAlunoDoBanco();
  renderizarInterface();

  // Mostra os botões de ação do aluno (Mudar Senha, Mudar E-mail, Sair)
  const acoesAluno = document.getElementById("acoesAluno");
  acoesAluno.style.display = "flex";
  acoesAluno.style.position = "fixed";
  acoesAluno.style.top = "10px";
  acoesAluno.style.left = "50%";
  acoesAluno.style.transform = "translateX(-50%)";
  acoesAluno.style.zIndex = "999";

  // Espaço no topo para não cobrir o nome do aluno
  document.querySelector(".header-app").style.paddingTop = "10px";
}

async function carregarDadosDoTreinadorLogado() {
  const seletor = document.getElementById("selectAluno");
  if (seletor) {
    seletor.style.display = "block";
  }
  const painel = document.getElementById("painelAdmin");
  painel.style.display = "block";
  painel.querySelector("h3").innerHTML =
    `<i class="fa-solid fa-user-gear"></i> ${currentUser.nome}`;
  painel.style.border = ""; // restaura tracejado do CSS

  // Mostra o botão sair no lugar normal
  const btnSair = document.getElementById("btnLogoutTrainer");
  btnSair.style.display = "flex";
  refreshAuthUI();
  await carregarAlunosDoBanco();
  renderizarInterface();
}

async function carregarBibliotecaDeExercicios() {
  let { data: items } = await _supabase
    .from("biblioteca_exercicios")
    .select("*")
    .order("musculo, nome_exercicio");
  bibliotecaCompleta = items || [];
  popularSelectMusculo();
}

async function carregarBibliotecaDeAlimentos() {
  let { data: items } = await _supabase
    .from("biblioteca_alimentos")
    .select("*")
    .order("nome_alimento");
  bibliotecaAlimentosCompleta = items || [];
  popularSelectTipoMacro();
}

async function dbCadastrarExercicio() {
  const musculo = getMusculoSelecionado();
  const nome = document.getElementById("add-lib-nome").value.trim();
  const gif = document.getElementById("add-lib-gif").value.trim();
  if (!musculo || !nome || !gif) return alert("Preencha todos os campos.");
  await _supabase
    .from("biblioteca_exercicios")
    .insert({ musculo, nome_exercicio: nome, gif_url: gif });
  alert("Exercício salvo!");
  document.getElementById("add-lib-nome").value = "";
  document.getElementById("add-lib-gif").value = "";
  await carregarBibliotecaDeExercicios();
}

async function dbCadastrarAlimentoReferencia() {
  const nomeAlimento = document.getElementById("add-ref-nome").value.trim();
  const tipoMacro = getMacroSelecionado();
  const qtd = Number(document.getElementById("add-ref-qtd").value);
  const prot = Number(document.getElementById("add-ref-prot").value);
  const carbo = Number(document.getElementById("add-ref-carbo").value);
  const gord = Number(document.getElementById("add-ref-gord").value);
  if (!nomeAlimento || !qtd) return alert("Preencha o nome e a porção padrão.");

  let kcal = prot * 4 + carbo * 4 + gord * 9;
  await _supabase.from("biblioteca_alimentos").insert({
    nome_alimento: nomeAlimento,
    tipo_macro: tipoMacro,
    quantidade_padrao: qtd,
    carbo_padrao: carbo,
    prot_padrao: prot,
    gord_padrao: gord,
    kcal_padrao: kcal,
  });
  alert("Alimento base indexado!");
  document.getElementById("add-ref-nome").value = "";
  await carregarBibliotecaDeAlimentos();
  popularSelectTipoMacro();
}

function popularSelectTipoMacro() {
  const container = document.getElementById("add-ref-macro-tipo");
  const trigger = document.getElementById("macro-select-trigger");
  const inputNovo = document.getElementById("macro-input-novo");
  if (!container || !trigger || !inputNovo) return;

  // Remove dropdown antigo se existir
  const oldDropdown = document.getElementById("macro-dropdown");
  if (oldDropdown) oldDropdown.remove();

  const macros = [
    ...new Set(
      bibliotecaAlimentosCompleta.map((al) => al.tipo_macro || "Carbo"),
    ),
  ];

  // Garante trigger visível e input escondido
  trigger.style.display = "block";
  inputNovo.style.display = "none";

  // Seta primeiro macro se trigger vazio
  if (!trigger.textContent || trigger.textContent === "") {
    trigger.textContent = macros.length > 0 ? macros[0] : "Carbo";
  }

  // Cria o dropdown
  const dropdown = document.createElement("div");
  dropdown.id = "macro-dropdown";
  dropdown.style.cssText =
    "display:none; position:absolute; top:100%; left:0; right:0; background:#1e293b; border:1px solid #4b5563; border-radius:8px; margin-top:4px; z-index:100; max-height:200px; overflow-x:hidden; overflow-y:auto;";

  // Opções existentes
  macros.forEach((m) => {
    const opt = document.createElement("div");
    opt.textContent = m;
    opt.dataset.value = m;
    opt.style.cssText =
      "padding:10px 12px; cursor:pointer; color:white; font-size:14px; transition:background 0.15s;";
    opt.addEventListener(
      "mouseenter",
      () => (opt.style.background = "#334155"),
    );
    opt.addEventListener(
      "mouseleave",
      () => (opt.style.background = "transparent"),
    );
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      selecionarMacro(m);
      dropdown.style.display = "none";
    });
    dropdown.appendChild(opt);
  });

  // Divider
  const divider = document.createElement("div");
  divider.style.cssText = "height:1px; background:#4b5563; margin:4px 8px;";
  dropdown.appendChild(divider);

  // Opção "novo macro"
  const optNovo = document.createElement("div");
  optNovo.innerHTML = "&#9998; novo macro";
  optNovo.style.cssText =
    "padding:10px 12px; cursor:pointer; color:#3b82f6; font-size:14px; transition:background 0.15s;";
  optNovo.addEventListener(
    "mouseenter",
    () => (optNovo.style.background = "#1e3a5f"),
  );
  optNovo.addEventListener(
    "mouseleave",
    () => (optNovo.style.background = "transparent"),
  );
  optNovo.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.style.display = "none";
    // Troca trigger por input
    trigger.style.display = "none";
    document.getElementById("macro-chevron").style.display = "none";
    inputNovo.style.display = "block";
    inputNovo.value = "";
    inputNovo.focus();
  });
  dropdown.appendChild(optNovo);

  container.appendChild(dropdown);

  // Abrir dropdown ao clicar no trigger
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("macro-dropdown");
    if (dd) {
      dd.style.display = dd.style.display === "block" ? "none" : "block";
    }
  });

  // Enter no input novo macro -> confirma
  inputNovo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputNovo.value.trim();
      if (val) {
        selecionarMacro(val);
        inputNovo.style.display = "none";
        trigger.style.display = "block";
        document.getElementById("macro-chevron").style.display = "block";
      }
    }
    if (e.key === "Escape") {
      inputNovo.style.display = "none";
      trigger.style.display = "block";
      document.getElementById("macro-chevron").style.display = "block";
    }
  });

  // Fechar ao clicar fora
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      const dd = document.getElementById("macro-dropdown");
      if (dd) dd.style.display = "none";
      // Se input estava visível, salva o valor e volta pro trigger
      if (inputNovo.style.display === "block") {
        const val = inputNovo.value.trim();
        if (val) selecionarMacro(val);
        inputNovo.style.display = "none";
        trigger.style.display = "block";
        document.getElementById("macro-chevron").style.display = "block";
      }
    }
  });
}

function selecionarMacro(valor) {
  const trigger = document.getElementById("macro-select-trigger");
  if (trigger) trigger.textContent = valor;
  const dd = document.getElementById("macro-dropdown");
  if (dd) dd.style.display = "none";
}

function getMacroSelecionado() {
  const inputNovo = document.getElementById("macro-input-novo");
  if (
    inputNovo &&
    inputNovo.style.display === "block" &&
    inputNovo.value.trim()
  ) {
    return inputNovo.value.trim();
  }
  const trigger = document.getElementById("macro-select-trigger");
  return trigger ? trigger.textContent.trim() : "";
}

// --- SELETOR DE MÚSCULO (MESMA LÓGICA DO MACRO) ---

function popularSelectMusculo() {
  const container = document.getElementById("add-lib-musculo");
  const trigger = document.getElementById("musculo-select-trigger");
  const inputNovo = document.getElementById("musculo-input-novo");
  if (!container || !trigger || !inputNovo) return;

  const oldDropdown = document.getElementById("musculo-dropdown");
  if (oldDropdown) oldDropdown.remove();

  const musculos = [
    ...new Set(bibliotecaCompleta.map((e) => e.musculo || "Peito")),
  ];

  trigger.style.display = "block";
  inputNovo.style.display = "none";

  if (!trigger.textContent || trigger.textContent === "") {
    trigger.textContent = musculos.length > 0 ? musculos[0] : "Peito";
  }

  const dropdown = document.createElement("div");
  dropdown.id = "musculo-dropdown";
  dropdown.style.cssText =
    "display:none; position:absolute; top:100%; left:0; right:0; background:#1e293b; border:1px solid #4b5563; border-radius:8px; margin-top:4px; z-index:100; max-height:200px; overflow-x:hidden; overflow-y:auto;";

  musculos.forEach((m) => {
    const opt = document.createElement("div");
    opt.textContent = m;
    opt.dataset.value = m;
    opt.style.cssText =
      "padding:10px 12px; cursor:pointer; color:white; font-size:14px; transition:background 0.15s;";
    opt.addEventListener(
      "mouseenter",
      () => (opt.style.background = "#334155"),
    );
    opt.addEventListener(
      "mouseleave",
      () => (opt.style.background = "transparent"),
    );
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      selecionarMusculo(m);
      dropdown.style.display = "none";
    });
    dropdown.appendChild(opt);
  });

  const divider = document.createElement("div");
  divider.style.cssText = "height:1px; background:#4b5563; margin:4px 8px;";
  dropdown.appendChild(divider);

  const optNovo = document.createElement("div");
  optNovo.innerHTML = "&#9998; novo músculo";
  optNovo.style.cssText =
    "padding:10px 12px; cursor:pointer; color:#3b82f6; font-size:14px; transition:background 0.15s;";
  optNovo.addEventListener(
    "mouseenter",
    () => (optNovo.style.background = "#1e3a5f"),
  );
  optNovo.addEventListener(
    "mouseleave",
    () => (optNovo.style.background = "transparent"),
  );
  optNovo.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.style.display = "none";
    trigger.style.display = "none";
    document.getElementById("musculo-chevron").style.display = "none";
    inputNovo.style.display = "block";
    inputNovo.value = "";
    inputNovo.focus();
  });
  dropdown.appendChild(optNovo);

  container.appendChild(dropdown);

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("musculo-dropdown");
    if (dd) {
      dd.style.display = dd.style.display === "block" ? "none" : "block";
    }
  });

  inputNovo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputNovo.value.trim();
      if (val) {
        selecionarMusculo(val);
        inputNovo.style.display = "none";
        trigger.style.display = "block";
        document.getElementById("musculo-chevron").style.display = "block";
      }
    }
    if (e.key === "Escape") {
      inputNovo.style.display = "none";
      trigger.style.display = "block";
      document.getElementById("musculo-chevron").style.display = "block";
    }
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      const dd = document.getElementById("musculo-dropdown");
      if (dd) dd.style.display = "none";
      if (inputNovo.style.display === "block") {
        const val = inputNovo.value.trim();
        if (val) selecionarMusculo(val);
        inputNovo.style.display = "none";
        trigger.style.display = "block";
        document.getElementById("musculo-chevron").style.display = "block";
      }
    }
  });
}

function selecionarMusculo(valor) {
  const trigger = document.getElementById("musculo-select-trigger");
  if (trigger) trigger.textContent = valor;
  const dd = document.getElementById("musculo-dropdown");
  if (dd) dd.style.display = "none";
}

function getMusculoSelecionado() {
  const inputNovo = document.getElementById("musculo-input-novo");
  if (
    inputNovo &&
    inputNovo.style.display === "block" &&
    inputNovo.value.trim()
  ) {
    return inputNovo.value.trim();
  }
  const trigger = document.getElementById("musculo-select-trigger");
  return trigger ? trigger.textContent.trim() : "";
}
function abrirGerenciadorExerciciosBanco() {
  modoGerenciamentoBancoAtivo = true;
  const modalHeader = document.querySelector(
    "#modalBiblioteca .modal-header h3",
  );
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fa-solid fa-folder-gear" style="color: var(--vermelho);"></i> Gerenciar Banco de Exercícios`;
  }
  document.getElementById("modalBiblioteca").style.display = "flex";
  renderizarAbasGerenciadorExercicios();
}

function abrirGerenciadorAlimentosBanco() {
  modoGerenciamentoBancoAtivo = true;
  const modalHeader = document.querySelector(
    "#modalAlimentosRef .modal-header h3",
  );
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fa-solid fa-folder-gear" style="color: var(--vermelho);"></i> Gerenciar Banco de Alimentos`;
  }
  document.getElementById("modalAlimentosRef").style.display = "flex";
  renderizarAbasGerenciadorAlimentos();
}

function renderizarAbasGerenciadorExercicios() {
  let ag = {};
  bibliotecaCompleta.forEach((e) => {
    if (!ag[e.musculo]) ag[e.musculo] = [];
    ag[e.musculo].push(e);
  });

  document.getElementById("modalBodyPastas").innerHTML = Object.keys(ag)
    .map(
      (m, i) => `
        <div class="pasta-musculo" onclick="alternarAcordeaoPasta('p_ex_gen_${i}')">
            <i class="fa-solid fa-folder" style="color:var(--vermelho);"></i> ${m} (${ag[m].length})
        </div>
        <div class="lista-exercicios-pasta" id="p_ex_gen_${i}">
          <div class="lista-exercicios-pasta-inner">
            ${ag[m]
              .map((ex) => {
                const nomeEscapado = ex.nome_exercicio.replace(/'/g, "\\'");
                return `<div class="item-exercicio-biblioteca" style="cursor:default;">
                    <span style="color: white; font-weight: 500;">${ex.nome_exercicio}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <button onclick="dbEditarNomeExercicio('${ex.id}', '${nomeEscapado}')" style="background:none; border:none; color:#3b82f6; cursor:pointer;" title="Editar Nome"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="dbDeletarExercicioBanco('${ex.id}', '${nomeEscapado}')" style="background:none; border:none; color:var(--vermelho); cursor:pointer;" title="Deletar permanentemente"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`,
    )
    .join("");
}

function renderizarAbasGerenciadorAlimentos() {
  let ag = {};
  bibliotecaAlimentosCompleta.forEach((al) => {
    let cat = al.tipo_macro || "Carbo";
    if (!ag[cat]) ag[cat] = [];
    ag[cat].push(al);
  });

  document.getElementById("modalBodyPastasAlimentos").innerHTML = Object.keys(
    ag,
  )
    .map(
      (macro, i) => `
        <div class="pasta-musculo" onclick="alternarAcordeaoPasta('p_al_gen_${i}')">
            <i class="fa-solid fa-folder" style="color:var(--vermelho);"></i> ${macro} (${ag[macro].length})
        </div>
        <div class="lista-exercicios-pasta" id="p_al_gen_${i}">
          <div class="lista-exercicios-pasta-inner">
            ${ag[macro]
              .map((al) => {
                const nomeEscapado = al.nome_alimento.replace(/'/g, "\\'");
                return `<div class="item-exercicio-biblioteca" style="cursor:default;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="color: white; font-weight:500;">${al.nome_alimento}</span>
                        <span style="font-size:11px; color: var(--texto-mutado);">${al.quantidade_padrao}g | C: ${al.carbo_padrao}g | P: ${al.prot_padrao}g | G: ${al.gord_padrao}g</span>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <button onclick="dbEditarValoresAlimento('${al.id}')" style="background:none; border:none; color:#3b82f6; cursor:pointer;" title="Editar Alimento"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="dbDeletarAlimentoBanco('${al.id}', '${nomeEscapado}')" style="background:none; border:none; color:var(--vermelho); cursor:pointer;" title="Deletar permanentemente"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`,
    )
    .join("");
}

async function dbDeletarExercicioBanco(id, nome) {
  if (
    !confirm(
      `⚠ ATENÇÃO TOTAL:\nQuer apagar permanentemente "${nome}" da biblioteca geral do sistema?`,
    )
  )
    return;
  await _supabase.from("biblioteca_exercicios").delete().eq("id", id);
  await carregarBibliotecaDeExercicios();
  renderizarAbasGerenciadorExercicios();
}

async function dbDeletarAlimentoBanco(id, nome) {
  if (
    !confirm(
      `⚠ ATENÇÃO TOTAL:\nQuer apagar permanentemente "${nome}" da tabela de alimentos global?`,
    )
  )
    return;
  await _supabase.from("biblioteca_alimentos").delete().eq("id", id);
  await carregarBibliotecaDeAlimentos();
  renderizarAbasGerenciadorAlimentos();
}

async function dbEditarNomeExercicio(id, nomeAtual) {
  const novoNome = prompt("Alterar nome do exercício para:", nomeAtual);
  if (!novoNome || novoNome.trim() === "" || novoNome === nomeAtual) return;
  await _supabase
    .from("biblioteca_exercicios")
    .update({ nome_exercicio: novoNome.trim() })
    .eq("id", id);
  await carregarBibliotecaDeExercicios();
  renderizarAbasGerenciadorExercicios();
}

async function dbEditarValoresAlimento(id) {
  // Força a busca comparando strings limpas
  const al = bibliotecaAlimentosCompleta.find(
    (item) => String(item.id) === String(id),
  );
  if (!al) return alert("Alimento não encontrado na memória local.");

  const novoNome = prompt("Nome do Alimento:", al.nome_alimento);
  if (!novoNome) return;
  const novaQtd = prompt("Porção padrão (g):", al.quantidade_padrao);
  const novoCarbo = prompt("Carboidratos (g):", al.carbo_padrao);
  const novaProt = prompt("Proteínas (g):", al.prot_padrao);
  const novaGord = prompt("Gorduras (g):", al.gord_padrao);

  let kcal =
    Number(novaProt) * 4 + Number(novoCarbo) * 4 + Number(novaGord) * 9;

  await _supabase
    .from("biblioteca_alimentos")
    .update({
      nome_alimento: novoNome.trim(),
      quantidade_padrao: Number(novaQtd),
      carbo_padrao: Number(novoCarbo),
      prot_padrao: Number(novaProt),
      gord_padrao: Number(novaGord),
      kcal_padrao: Number(kcal.toFixed(0)),
    })
    .eq("id", id);

  await carregarBibliotecaDeAlimentos();
  renderizarAbasGerenciadorAlimentos();
}

// --- MODAL DE GERENCIAMENTO DE ALUNOS ---
function abrirModalAlunos() {
  renderListaAlunos();
  document.getElementById("modalAlunos").style.display = "flex";
}
function fecharModalAlunos() {
  document.getElementById("modalAlunos").style.display = "none";
}
function renderListaAlunos() {
  document.getElementById("listaAlunosParaEditar").innerHTML =
    listaGlobalAlunosCompleta
      .map(
        (al, idx) => `
        <div class="item-aluno-edicao">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px;">
                    <input type="text" class="input-inline" value="${al.nome}" onchange="listaGlobalAlunosCompleta[${idx}].nome = this.value; atualizarAlunoBanco(${idx})">
                    <input type="email" class="input-inline" value="${al.email || ""}" onchange="listaGlobalAlunosCompleta[${idx}].email = this.value; atualizarAlunoBanco(${idx})">
                    <select class="input-inline" style="background:#0f172a; color:white; border:1px solid #4b5563; padding:6px; border-radius:6px;" onchange="listaGlobalAlunosCompleta[${idx}].sexo = this.value; atualizarAlunoBanco(${idx})">
                        <option value="" ${!al.sexo ? "selected" : ""}>Sexo</option>
                        <option value="Masculino" ${al.sexo === "Masculino" ? "selected" : ""}>Masculino</option>
                        <option value="Feminino" ${al.sexo === "Feminino" ? "selected" : ""}>Feminino</option>
                    </select>
                </div>
                <button class="btn btn-alunos" onclick="atualizarAlunoBanco(${idx})" title="Salvar alterações" style="padding: 6px 8px; font-size: 13px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-remover" onclick="confirmarDeletarAluno(${idx})" title="Excluir" style="padding: 6px 8px; font-size: 13px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `,
      )
      .join("");
}
async function atualizarAlunoBanco(idx) {
  const al = listaGlobalAlunosCompleta[idx];
  await _supabase
    .from("alunos")
    .update({ nome: al.nome, email: al.email, sexo: al.sexo || null })
    .eq("id", al.id);
  document.getElementById("selectAluno").options[idx].text = al.nome;

  // Feedback visual no botão
  const botoes = document.querySelectorAll(
    "#listaAlunosParaEditar .btn-alunos",
  );
  if (botoes[idx]) {
    botoes[idx].style.background = "var(--verde)";
    setTimeout(() => {
      botoes[idx].style.background = "";
    }, 800);
  }
}

function confirmarDeletarAluno(idx) {
  const al = listaGlobalAlunosCompleta[idx];
  if (
    !confirm(
      `Tem certeza que deseja excluir "${al.nome}"?\n\nOs dados de treino e dieta deste aluno serão perdidos. Esta ação não pode ser desfeita.`,
    )
  )
    return;
  dbDeletarAluno(idx);
}

async function dbDeletarAluno(idx) {
  const al = listaGlobalAlunosCompleta[idx];
  const alunoId = al.id;

  try {
    // 1. Busca blocos de treino do aluno
    const { data: blocos } = await _supabase
      .from("treinos_blocos")
      .select("id")
      .eq("aluno_id", alunoId);

    if (blocos && blocos.length > 0) {
      const blocoIds = blocos.map((b) => b.id);

      // 2. Deleta exercícios dos blocos
      await _supabase
        .from("treinos_exercicios")
        .delete()
        .in("bloco_id", blocoIds);

      // 3. Deleta os blocos
      await _supabase.from("treinos_blocos").delete().eq("aluno_id", alunoId);
    }

    // 4. Busca dias de dieta do aluno
    const { data: dias } = await _supabase
      .from("dieta_dias")
      .select("id")
      .eq("aluno_id", alunoId);

    if (dias && dias.length > 0) {
      const diaIds = dias.map((d) => d.id);

      // 5. Deleta alimentos dos dias
      await _supabase.from("dieta_alimentos").delete().in("dia_id", diaIds);

      // 6. Deleta os dias
      await _supabase.from("dieta_dias").delete().eq("aluno_id", alunoId);
    }

    // 7. Deleta evolução (feedbacks + fotos)
    const { data: feedbacks } = await _supabase
      .from("evolucao_feedbacks")
      .select("id")
      .eq("aluno_id", alunoId);

    if (feedbacks && feedbacks.length > 0) {
      await _supabase
        .from("evolucao_feedbacks")
        .delete()
        .eq("aluno_id", alunoId);
    }

    // 8. Deleta fotos do storage (se houver)
    try {
      const { data: arquivos } = await _supabase.storage
        .from("fotos-evolucao")
        .list(alunoId + "/");
      if (arquivos && arquivos.length > 0) {
        await _supabase.storage
          .from("fotos-evolucao")
          .remove(arquivos.map((f) => alunoId + "/" + f.name));
      }
      // Tenta deletar a pasta raiz do aluno
      await _supabase.storage.from("fotos-evolucao").remove([alunoId + "/"]);
    } catch (e) {
      // Pode não ter fotos — ignora erro
    }

    // 9. Deleta o aluno da tabela
    const { error } = await _supabase.from("alunos").delete().eq("id", alunoId);
    if (error) throw error;

    alert(
      `Aluno "${al.nome}" e todos os seus dados (treino, dieta, evolução) foram excluídos.`,
    );
    await carregarAlunosDoBanco();
    renderListaAlunos();
  } catch (err) {
    console.error("Erro ao excluir aluno:", err);
    alert("Erro ao excluir: " + (err.message || JSON.stringify(err)));
  }
}

async function dbCriarAlunoRaiz() {
  const nome = document.getElementById("novo-nome-aluno").value.trim();
  const email = document.getElementById("novo-email-aluno").value.trim();
  const sexo = document.getElementById("novo-sexo-aluno").value;
  if (!nome || !email) return alert("Preencha nome e e-mail.");
  if (!sexo) return alert("Selecione o sexo do aluno.");

  // Opcional: Validar formato do email básico
  if (!email.includes("@")) return alert("E-mail inválido.");

  const { error } = await _supabase
    .from("alunos")
    .insert({ nome, email, sexo });
  if (error) {
    if (error.code === "23505") {
      return alert("Este e-mail já está cadastrado em outro aluno.");
    }
    return alert("Erro ao inserir aluno: " + error.message);
  }

  alert(
    "Aluno inserido! Agora o aluno pode acessar o site e criar a senha dele no primeiro acesso.",
  );
  document.getElementById("novo-nome-aluno").value = "";
  document.getElementById("novo-email-aluno").value = "";
  document.getElementById("novo-sexo-aluno").value = "";
  await carregarAlunosDoBanco();
  renderListaAlunos();
}

// --- AUTENTICAÇÃO E AUTORIZAÇÃO ---
function refreshAuthUI() {
  if (!AUTENTICACAO_ATIVA) {
    document.getElementById("selectAluno").style.display = "block";
    document.getElementById("btnEditar").style.display = "flex";
    document.getElementById("btnGerenciarAlunos").style.display = "flex";
    document.getElementById("btnSalvar").style.display = "flex";
    return;
  }

  const isAluno = currentUser.role === "aluno";
  document.getElementById("selectAluno").style.display = isAluno
    ? "none"
    : "block";
  document.getElementById("btnEditar").style.display = isAluno
    ? "none"
    : "flex";
  document.getElementById("btnGerenciarAlunos").style.display = "none";
  document.getElementById("btnSalvar").style.display = "none";
}

// --- LÓGICA DE CÁLCULO DE MACROS ---
function recalcularCaloriasAutomaticas(idxD, idxR, idxA) {
  let item = dadosDoAluno.rotinasDieta[idxD].refeicoes[idxR].alimentos[idxA];
  item.kcalTotal = Number(
    (item.protTotal * 4 + item.carboTotal * 4 + item.gordTotal * 9).toFixed(0),
  );
  renderizarModoTreinador();
}

function recalcularMacrosPorPesoDigitado(idxD, idxR, idxA) {
  let item = dadosDoAluno.rotinasDieta[idxD].refeicoes[idxR].alimentos[idxA];
  if (!item.porcaoBase) return;
  let factor = item.quantidade / item.porcaoBase;
  item.carboTotal = Number((item.carboBase * factor).toFixed(1));
  item.protTotal = Number((item.protBase * factor).toFixed(1));
  item.gordTotal = Number((item.gordBase * factor).toFixed(1));
  item.kcalTotal = Number(
    (item.protTotal * 4 + item.carboTotal * 4 + item.gordTotal * 9).toFixed(0),
  );
  renderizarModoTreinador();
}

// --- RECUPERAÇÃO DE DIETA E TREINO DO ALUNO ---
async function puxarDadosDoAlunoDoBanco() {
  if (!alunoIdSelecionado) return;
  let { data: blocos } = await _supabase
    .from("treinos_blocos")
    .select("*")
    .eq("aluno_id", alunoIdSelecionado)
    .order("ordem");
  let treinos = [];
  if (blocos) {
    for (let b of blocos) {
      // CORREÇÃO AQUI: Mudado de .order('id') para .order('ordem')
      let { data: exs } = await _supabase
        .from("treinos_exercicios")
        .select("*")
        .eq("bloco_id", b.id)
        .order("ordem");
      treinos.push({
        idBloco: b.id,
        nomeBloco: b.nome_bloco,
        exercicios: (exs || []).map((ex) => ({
          ...ex,
          nome2: ex.nome2 || "",
          gif_url2: ex.gif_url2 || "",
        })),
      });
    }
  }
  let { data: dias } = await _supabase
    .from("dieta_dias")
    .select("*")
    .eq("aluno_id", alunoIdSelecionado)
    .order("ordem");
  let dietas = [];
  if (dias) {
    for (let d of dias) {
      let { data: alims } = await _supabase
        .from("dieta_alimentos")
        .select("*")
        .eq("dia_id", d.id);
      let refs = {};
      if (alims) {
        alims.forEach((al) => {
          if (!refs[al.nome_refeicao])
            refs[al.nome_refeicao] = {
              nomeRefeicao: al.nome_refeicao,
              alimentos: [],
            };
          let q = al.quantidade;
          refs[al.nome_refeicao].alimentos.push({
            id: al.id,
            nome: al.nome_alimento,
            quantidade: q,
            carboTotal: Number((al.carbo_g * q).toFixed(1)),
            protTotal: Number((al.prot_g * q).toFixed(1)),
            gordTotal: Number((al.gord_g * q).toFixed(1)),
            kcalTotal: Number((al.kcal_g * q).toFixed(0)),
            porcaoBase: 100,
            carboBase: al.carbo_g * 100,
            protBase: al.prot_g * 100,
            gordBase: al.gord_g * 100,
          });
        });
      }
      dietas.push({
        idDia: d.id,
        nomeDia: d.nome_dia,
        refeicoes: Object.values(refs),
      });
    }
  }
  dadosDoAluno.rotinasTreino = treinos;
  dadosDoAluno.rotinasDieta = dietas;
  renderizarInterface();
}

function renderizarInterface() {
  document.getElementById("appContainer").classList.remove("modo-edicao-ativo");
  if (modoEdicaoAtivo) {
    renderizarModoTreinador();
  } else {
    renderizarModoAluno();
  }
  carregarFeedbacksEvolucao();
}

// --- FUNÇÕES DE TRANSIÇÃO E GIF INLINE ---
function removerLinhaGifComAnimacao() {
  const linhaExistente = document.getElementById("linha-gif-dinamica");
  const wrapper = document.getElementById("wrapper-gif-elemento");
  if (linhaExistente && wrapper) {
    wrapper.classList.remove("aberto");
    linhaExistente.id = "linha-gif-deletando";
    setTimeout(() => {
      linhaExistente.remove();
    }, 500);
  }
}

function gerenciarIframeInjetado(exId, url) {
  // Se for exercício conjugado (exId terminando em "-2"), busca a linha sem o sufixo
  const exIdReal = exId.endsWith("-2") ? exId.slice(0, -2) : exId;
  const staticLine = document.getElementById(`linha-ex-${exIdReal}`);
  if (!staticLine) return;

  if (idExercicioComGifAberto === exId) {
    removerLinhaGifComAnimacao();
    idExercicioComGifAberto = null;
    return;
  }

  const linhaExistente = document.getElementById("linha-gif-dinamica");

  if (linhaExistente) {
    const wrapperAnitgo = document.getElementById("wrapper-gif-elemento");
    if (wrapperAnitgo) {
      wrapperAnitgo.classList.remove("aberto");

      setTimeout(() => {
        staticLine.parentNode.insertBefore(
          linhaExistente,
          staticLine.nextSibling,
        );

        wrapperAnitgo.innerHTML = `<iframe src="${url}" allow="autoplay" scrolling="no" style="overflow: hidden;"></iframe>`;

        setTimeout(() => {
          wrapperAnitgo.classList.add("aberto");
        }, 50);
      }, 500);
    }
    idExercicioComGifAberto = exId;
    return;
  }

  const novaLinha = document.createElement("tr");
  novaLinha.id = "linha-gif-dinamica";
  novaLinha.className = "linha-gif-inline";
  novaLinha.innerHTML = `
                <td colspan="4">
                    <div class="wrapper-gif-inline" id="wrapper-gif-elemento">
                        <iframe src="${url}" allow="autoplay" scrolling="no" style="overflow: hidden;"></iframe>
                    </div>
                </td>
            `;

  staticLine.parentNode.insertBefore(novaLinha, staticLine.nextSibling);
  idExercicioComGifAberto = exId;

  // Pequeno delay para iniciar transição
  setTimeout(() => {
    document.getElementById("wrapper-gif-elemento").classList.add("aberto");
  }, 50);
}

function alternarBlocoLayout(id, tipoAba) {
  const elClicado = document.getElementById(id);
  if (!elClicado) return;

  const containerPaiId =
    tipoAba === "treino"
      ? "container-blocos-treino"
      : "conteudo-refeicoes-dinamicas";
  const todosOsBlocos = document
    .getElementById(containerPaiId)
    .querySelectorAll(".bloco-secao");
  const jaEstavaExpandido = elClicado.classList.contains("expandido");

  if (tipoAba === "treino") {
    removerLinhaGifComAnimacao();
    idExercicioComGifAberto = null;
  }

  todosOsBlocos.forEach((bloco) => {
    bloco.classList.remove("expandido");
    // Fechar refeicoes dentro do bloco
    bloco.querySelectorAll("[id^='corpo-ref-']").forEach((r) => {
      r.classList.remove("expandido");
    });
    // Fechar headers das refeicoes
    bloco.querySelectorAll(".header-bloco-editavel.expandido").forEach((h) => {
      h.classList.remove("expandido");
    });
  });

  if (!jaEstavaExpandido) {
    elClicado.classList.add("expandido");
    setTimeout(() => {
      elClicado.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
  }
}

function alternarAcordeaoPasta(idConteudo) {
  const el = document.getElementById(idConteudo);
  if (!el) return;

  if (!el.classList.contains("aberta")) {
    const parent = el.parentElement;
    parent
      .querySelectorAll(".lista-exercicios-pasta.aberta")
      .forEach((aberta) => {
        if (aberta.id !== idConteudo) aberta.classList.remove("aberta");
      });
  }
  el.classList.toggle("aberta");
}

// --- ACORDEAO: SO 1 BLOCO ABERTO POR VEZ ---
function alternarBlocoUnico(id) {
  const containers = [
    "container-blocos-treino",
    "conteudo-refeicoes-dinamicas",
  ];
  const jaExpandido = document
    .getElementById(id)
    ?.classList.contains("expandido");

  // Limpar TUDO
  estadosAbasExpandidas = {};
  estadosRefeicoesExpandidas = {};

  containers.forEach((cid) => {
    const c = document.getElementById(cid);
    if (c)
      c.querySelectorAll(".bloco-secao").forEach((b) => {
        b.classList.remove("expandido");
        // Fechar todas as refeicoes dentro deste dia
        b.querySelectorAll("[id^='corpo-ref-']").forEach((r) => {
          r.classList.remove("expandido");
          const wrapper = r.parentElement;
          if (wrapper) {
            const header = wrapper.querySelector(".header-bloco-editavel");
            if (header) header.classList.remove("expandido");
          }
        });
      });
  });

  // Se NAO estava expandido, expande
  if (!jaExpandido) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("expandido");
      estadosAbasExpandidas[id] = true;
    }
  }
  removerLinhaGifComAnimacao();
  idExercicioComGifAberto = null;
}

// --- RENDERIZAR MODO ALUNO (VISUALIZAÇÃO) ---
function renderizarModoAluno() {
  document.getElementById("container-blocos-treino").innerHTML =
    dadosDoAluno.rotinasTreino
      .map((b) => {
        let linesHtml = b.exercicios
          .map((ex) => {
            const temConjugado = !!ex.nome2;
            const nomeEx1 = ex.nome;
            const nomeEx2 = ex.nome2 || "";
            const gifUrl1 = ex.gif_url || "";
            const gifUrl2 = ex.gif_url2 || "";

            let tdExercicio;
            if (temConjugado) {
              tdExercicio = `<td style="white-space:nowrap;">
                  <span style="color:var(--cor-neon);cursor:pointer;" onclick="gerenciarIframeInjetado('${ex.id}', '${gifUrl1}')">
                    <i class="fa-solid fa-play-circle" id="icone-gif-${ex.id}" style="margin-right:3px;"></i>${nomeEx1}
                  </span>
                  <span style="color:var(--texto-mutado);margin:0 4px;">+</span>
                  <span style="color:var(--cor-neon);cursor:pointer;" onclick="gerenciarIframeInjetado('${ex.id}-2', '${gifUrl2}')">
                    <i class="fa-solid fa-play-circle" id="icone-gif-${ex.id}-2" style="margin-right:3px;"></i>${nomeEx2}
                  </span>
                </td>`;
            } else {
              tdExercicio = `<td style="color:var(--cor-neon);cursor:pointer;" onclick="gerenciarIframeInjetado('${ex.id}', '${gifUrl1}')">
                  <i class="fa-solid fa-play-circle" id="icone-gif-${ex.id}" style="margin-right:5px;"></i>${nomeEx1}
                </td>`;
            }

            let linhaBase = `<tr id="linha-ex-${ex.id}">
                ${tdExercicio}
                <td>${ex.series}</td>
                <td>${ex.reps}</td>
                <td>${ex.descanso}</td>
            </tr>`;
            return linhaBase;
          })
          .join("");

        return `
        <div class="bloco-secao" id="${b.idBloco}">
            <div class="header-bloco-editavel" onclick="alternarBlocoLayout('${b.idBloco}', 'treino')">
                <div class="titulo-secao">${b.nomeBloco} <i class="fa-solid fa-chevron-down seta-recolher"></i></div>
            </div>
            <div class="corpo-recolhivel">
              <div class="corpo-recolhivel-inner">
                <table>
                    <thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Desc.</th></tr></thead>
                    <tbody>${linesHtml}</tbody>
                </table>
              </div>
            </div>
        </div>`;
      })
      .join("");

  if (dadosDoAluno.rotinasDieta.length === 0) {
    document.getElementById("conteudo-refeicoes-dinamicas").innerHTML =
      '<p style="text-align:center; padding:20px; color:var(--texto-mutado);">Nenhuma dieta ativa cadastrada.</p>';
    return;
  }

  document.getElementById("conteudo-refeicoes-dinamicas").innerHTML =
    dadosDoAluno.rotinasDieta
      .map((dia) => {
        let diaKcal = 0,
          diaCarbo = 0,
          diaProt = 0,
          diaGord = 0;

        let htmlRefeicoesDoDia = dia.refeicoes
          .map((ref) => {
            let refKcal = 0,
              refCarbo = 0,
              refProt = 0,
              refGord = 0;
            let linesAlimentos = ref.alimentos
              .map((al) => {
                refKcal += al.kcalTotal;
                refCarbo += al.carboTotal;
                refProt += al.protTotal;
                refGord += al.gordTotal;
                return `<tr><td>${al.nome}</td><td>${al.quantidade}</td><td style="font-size:12px; color:var(--texto-mutado);">${Math.round(al.carboTotal)}g C / ${Math.round(al.protTotal)}g P / ${Math.round(al.gordTotal)}g G</td></tr>`;
              })
              .join("");

            diaKcal += refKcal;
            diaCarbo += refCarbo;
            diaProt += refProt;
            diaGord += refGord;

            return `
                <div style="background:#111827;border-radius:8px;margin-bottom:15px;border:1px solid #334155;overflow:hidden;">
                    <div class="header-bloco-editavel" onclick="const el=document.getElementById('corpo-ref-${dia.idDia}-${ref.nomeRefeicao.replace(/\s/g, "")}');const aberta=!el.classList.contains('expandido');el.classList.toggle('expandido');estadosRefeicoesExpandidas['ref-${dia.idDia}-${ref.nomeRefeicao.replace(/\s/g, "")}']=aberta;this.classList.toggle('expandido');" style="padding:12px;margin-bottom:0;cursor:pointer;">
                        <span style="font-weight:bold;font-size:14px;color:var(--texto-claro);">${ref.nomeRefeicao}</span>
                        <span style="color:var(--cor-neon);font-size:13px;display:flex;align-items:center;gap:8px;">
                            ${Math.round(refKcal)} Kcal
                            <i class="fa-solid fa-chevron-down seta-recolher" style="font-size:12px;"></i>
                        </span>
                    </div>
                    <div class="corpo-recolhivel ${estadosRefeicoesExpandidas["ref-" + dia.idDia + "-" + ref.nomeRefeicao.replace(/\s/g, "")] ? "expandido" : ""}" id="corpo-ref-${dia.idDia}-${ref.nomeRefeicao.replace(/\s/g, "")}">
                        <div class="corpo-recolhivel-inner">
                            <div style="padding:0 12px 12px;">
                                <table><thead><tr><th>Alimento</th><th>Qtd</th><th>Macros</th></tr></thead><tbody>${linesAlimentos}</tbody></table>
                                                            <div class="resumo-macros" style="margin-top:8px;">
                                                                <div class="macro-box"><p>Kcal</p><div>${Math.round(refKcal)}</div></div>
                                                                <div class="macro-box"><p>Carbo</p><div>${Math.round(refCarbo)}g</div></div>
                                                                <div class="macro-box"><p>Prot</p><div>${Math.round(refProt)}g</div></div>
                                                                <div class="macro-box"><p>Gord</p><div>${Math.round(refGord)}g</div></div>
                                                            </div>
                                                            </div>
                        </div>
                    </div>
                </div>`;
          })
          .join("");

        if (dia.refeicoes.length === 0) {
          htmlRefeicoesDoDia =
            '<p style="color:var(--texto-mutado); font-size:13px; padding:10px 0;">Nenhuma refeição cadastrada para este dia.</p>';
        }

        return `
            <div class="bloco-secao dieta-fade-in" id="${dia.idDia}">
                <div class="header-bloco-editavel" onclick="alternarBlocoLayout('${dia.idDia}', 'dieta')">
                    <div class="titulo-secao">
                        <span><i class="fa-solid fa-calendar-day" style="color: var(--cor-neon); margin-right: 8px;"></i>${dia.nomeDia}</span>
                        <span style="font-size:13px; color:var(--cor-neon); margin-left:auto; font-weight:bold;">
                            Total: ${Math.round(diaKcal)} Kcal
                        </span>
                        <i class="fa-solid fa-chevron-down seta-recolher" style="margin-left: 12px;"></i>
                    </div>
                </div>
                <div class="corpo-recolhivel">
                  <div class="corpo-recolhivel-inner">
                    ${htmlRefeicoesDoDia}
                    <div class="resumo-macros">
                        <div class="macro-box"><p>Kcal</p><div>${Math.round(diaKcal)}</div></div>
                        <div class="macro-box"><p>Carbo</p><div>${Math.round(diaCarbo)}g</div></div>
                        <div class="macro-box"><p>Prot</p><div>${Math.round(diaProt)}g</div></div>
                        <div class="macro-box"><p>Gord</p><div>${Math.round(diaGord)}g</div></div>
                    </div>
                  </div>
                </div>
            </div>`;
      })
      .join("");
}

// --- DRAG AND DROP (TREINO) ---
function dragBlocoStart(event, idx) {
  blocoArrastadoIdx = idx;
  event.dataTransfer.effectAllowed = "move";
}
function dragBlocoOver(event, idx) {
  event.preventDefault();
  if (blocoArrastadoIdx === null || blocoArrastadoIdx === idx) return;
  const itemArrastado = dadosDoAluno.rotinasTreino.splice(
    blocoArrastadoIdx,
    1,
  )[0];
  dadosDoAluno.rotinasTreino.splice(idx, 0, itemArrastado);
  blocoArrastadoIdx = idx;
  renderizarModoTreinador();
}
function dragBlocoEnd() {
  blocoArrastadoIdx = null;
}

function dragExercicioStart(event, bIdx, eIdx) {
  exercicioArrastadoCoords = { bIdx, eIdx };
  event.dataTransfer.effectAllowed = "move";
  event.stopPropagation();
}
function dragExercicioOver(event, bIdx, eIdx) {
  event.preventDefault();
  event.stopPropagation();
  const original = exercicioArrastadoCoords;
  if (
    original.bIdx === null ||
    original.bIdx !== bIdx ||
    (original.bIdx === bIdx && original.eIdx === eIdx)
  )
    return;

  const bloco = dadosDoAluno.rotinasTreino[bIdx];
  const itemArrastado = bloco.exercicios.splice(original.eIdx, 1)[0];
  bloco.exercicios.splice(eIdx, 0, itemArrastado);
  exercicioArrastadoCoords = { bIdx, eIdx };
  renderizarModoTreinador();
}
function dragExercicioEnd(event) {
  event.stopPropagation();
  exercicioArrastadoCoords = { bIdx: null, eIdx: null };
}

// --- DRAG AND DROP (DIETA) ---
function dragDiaStart(event, dIdx) {
  diaArrastadoIdx = dIdx;
  event.dataTransfer.effectAllowed = "move";
}
function dragDiaOver(event, dIdx) {
  event.preventDefault();
  if (diaArrastadoIdx === null || diaArrastadoIdx === dIdx) return;
  const itemArrastado = dadosDoAluno.rotinasDieta.splice(diaArrastadoIdx, 1)[0];
  dadosDoAluno.rotinasDieta.splice(dIdx, 0, itemArrastado);
  diaArrastadoIdx = dIdx;
  renderizarModoTreinador();
}
function dragDiaEnd() {
  diaArrastadoIdx = null;
}

function dragRefeicaoStart(event, dIdx, rIdx) {
  refeicaoArrastadaCoords = { dIdx, rIdx };
  event.dataTransfer.effectAllowed = "move";
  event.stopPropagation();
}
function dragRefeicaoOver(event, dIdx, rIdx) {
  event.preventDefault();
  event.stopPropagation();
  const original = refeicaoArrastadaCoords;
  if (
    original.dIdx === null ||
    original.dIdx !== dIdx ||
    (original.dIdx === dIdx && original.rIdx === rIdx)
  )
    return;

  const dia = dadosDoAluno.rotinasDieta[dIdx];
  const itemArrastado = dia.refeicoes.splice(original.rIdx, 1)[0];
  dia.refeicoes.splice(rIdx, 0, itemArrastado);
  refeicaoArrastadaCoords = { dIdx, rIdx };
  renderizarModoTreinador();
}
function dragRefeicaoEnd(event) {
  event.stopPropagation();
  refeicaoArrastadaCoords = { dIdx: null, rIdx: null };
}

function renderizarModoTreinador() {
  removerLinhaGifComAnimacao();

  // 1. Renderizar Treinos
  document.getElementById("container-blocos-treino").innerHTML =
    dadosDoAluno.rotinasTreino
      .map(
        (b, bIdx) => `
        <div class="bloco-secao ${estadosAbasExpandidas[b.idBloco] ? "expandido" : ""}" id="${b.idBloco}" draggable="true" ondragstart="dragBlocoStart(event, ${bIdx})" ondragover="dragBlocoOver(event, ${bIdx})" ondragend="dragBlocoEnd()">
            <div class="header-bloco-editavel" onclick="if(!['INPUT','SELECT','BUTTON'].includes(event.target.tagName) && !event.target.classList.contains('drag-handle')) { alternarBlocoUnico('${b.idBloco}'); }">
                <input type="text" class="input-inline" style="color:var(--cor-neon); font-weight:bold;" value="${b.nomeBloco}" onchange="dadosDoAluno.rotinasTreino[${bIdx}].nomeBloco = this.value" onclick="event.stopPropagation();">
                <div style="display:flex; align-items:center; gap:10px; margin-left:auto;">
                    <button class="btn-danger" onclick="event.stopPropagation(); dadosDoAluno.rotinasTreino.splice(${bIdx},1); renderizarModoTreinador();">Excluir</button>
                    <i class="fa-solid fa-chevron-down seta-recolher"></i>
                    <i class="fa-solid fa-bars drag-handle" style="cursor: grab; color: #9ca3af; padding: 5px 10px; font-size: 18px;" title="Arrastar Bloco"></i>
                </div>
            </div>
            <div class="corpo-recolhivel">
              <div class="corpo-recolhivel-inner">
                <table>
                    <thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Desc.</th><th>Del</th><th style="width: 40px;">Mover</th></tr></thead>
                    <tbody>
                        ${b.exercicios
                          .map(
                            (ex, eIdx) => `
                            <tr draggable="true" ondragstart="dragExercicioStart(event, ${bIdx}, ${eIdx})" ondragover="dragExercicioOver(event, ${bIdx}, ${eIdx})" ondragend="dragExercicioEnd(event)">
                                <td><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${gerarSelectExerciciosPorMusculo(ex.nome, `onChangeExercicioSelect(this, ${bIdx}, ${eIdx})`)}${ex.nome2 ? `<span style="color:var(--texto-mutado);font-weight:bold;font-size:16px;">+</span>${gerarSelectExerciciosPorMusculo(ex.nome2, `onChangeExercicioSelect2(this, ${bIdx}, ${eIdx})`)}<button class="btn-remover" onclick="removerExercicioConjugado(${bIdx}, ${eIdx})" style="padding:3px 6px;font-size:10px;" title="Remover exercício conjugado"><i class="fa-solid fa-xmark"></i></button>` : `<button class="btn-conjugar" onclick="abrirModalBibliotecaParaConjugar(${bIdx}, ${eIdx})" title="Adicionar exercício conjugado"><i class="fa-solid fa-link"></i></button>`}</div></td>
                                <td>${gerarSelectHtml(LISTA_SERIES, ex.series, `dadosDoAluno.rotinasTreino[${bIdx}].exercicios[${eIdx}].series=this.value`)}</td>
                                <td>${gerarSelectHtml(LISTA_REPS, ex.reps, `dadosDoAluno.rotinasTreino[${bIdx}].exercicios[${eIdx}].reps=this.value`)}</td>
                                <td>${gerarSelectHtml(LISTA_DESCANSO, ex.descanso, `dadosDoAluno.rotinasTreino[${bIdx}].exercicios[${eIdx}].descanso=this.value`)}</td>
                                <td><button class="btn-remover" onclick="dadosDoAluno.rotinasTreino[${bIdx}].exercicios.splice(${eIdx},1); renderizarModoTreinador();"><i class="fa-solid fa-trash"></i></button></td>
                                <td style="text-align: center;"><i class="fa-solid fa-grip-lines drag-handle" style="cursor: grab; color: #6b7280; font-size: 16px;" title="Arrastar Exercício"></i></td>
                            </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
                <button class="btn btn-add" onclick="abrirModalBibliotecaParaBloco('${b.idBloco}')"><i class="fa-solid fa-folder-plus"></i> Buscar Exercício na Biblioteca</button>
              </div>
            </div>
        </div>`,
      )
      .join("");

  // 2. Renderizar Dietas
  document.getElementById("conteudo-refeicoes-dinamicas").innerHTML =
    dadosDoAluno.rotinasDieta
      .map(
        (d, dIdx) => `
        <div class="bloco-secao ${estadosAbasExpandidas[d.idDia] ? "expandido" : ""}" id="${d.idDia}" draggable="true" ondragstart="dragDiaStart(event, ${dIdx})" ondragover="dragDiaOver(event, ${dIdx})" ondragend="dragDiaEnd()" style="border:1px dashed var(--cor-neon); padding:15px; border-radius:12px; margin-bottom:20px; background: var(--bg-card);">
            <div class="header-bloco-editavel" onclick="if(!['INPUT','SELECT','BUTTON'].includes(event.target.tagName) && !event.target.classList.contains('drag-handle')) { alternarBlocoUnico('${d.idDia}'); }">
                <div style="display:flex; gap:5px; align-items:center;">
                    <i class="fa-solid fa-calendar-day" style="color:var(--cor-neon);"></i>
                    <input type="text" class="input-inline" style="width:160px; font-weight:bold; color:white;" value="${d.nomeDia}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].nomeDia = this.value" onclick="event.stopPropagation();">
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-left:auto;">
                    <button class="btn-danger" style="padding: 8px 12px;" onclick="event.stopPropagation(); dadosDoAluno.rotinasDieta.splice(${dIdx},1); renderizarModoTreinador();"><i class="fa-solid fa-trash"></i> Excluir Dia</button>
                    <i class="fa-solid fa-chevron-down seta-recolher"></i>
                    <i class="fa-solid fa-bars drag-handle" style="cursor: grab; color: #9ca3af; padding: 5px 10px; font-size: 18px;" title="Arrastar Dia"></i>
                </div>
            </div>

            <div class="corpo-recolhivel">
              <div class="corpo-recolhivel-inner">
                ${d.refeicoes
                  .map(
                    (ref, rIdx) => `
                    <div style="background:#111827;border-radius:8px;margin-bottom:12px;border:1px solid #334155;overflow:hidden;" draggable="true" ondragstart="dragRefeicaoStart(event, ${dIdx}, ${rIdx})" ondragover="dragRefeicaoOver(event, ${dIdx}, ${rIdx})" ondragend="dragRefeicaoEnd(event)">
                        <div class="header-bloco-editavel" onclick="if(!event.target.classList.contains('drag-handle')){const el=document.getElementById('corpo-ref-trainer-${d.idDia}-${rIdx}');const aberta=!el.classList.contains('expandido');el.classList.toggle('expandido');estadosRefeicoesExpandidas['ref-trainer-${d.idDia}-${rIdx}']=aberta;this.classList.toggle('expandido');}" style="padding:10px;margin-bottom:0;cursor:pointer;">
                            <input type="text" class="input-inline" value="${ref.nomeRefeicao}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].nomeRefeicao=this.value" onclick="event.stopPropagation();">
                            <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                                <button class="btn-danger" onclick="event.stopPropagation(); dadosDoAluno.rotinasDieta[${dIdx}].refeicoes.splice(${rIdx},1); renderizarModoTreinador();">Excluir</button>
                                <i class="fa-solid fa-chevron-down seta-recolher" style="font-size:14px;"></i>
                                <i class="fa-solid fa-grip-lines drag-handle" style="cursor:grab;color:#6b7280;font-size:16px;" title="Arrastar Refeição"></i>
                            </div>
                        </div>
                        <div class="corpo-recolhivel ${estadosRefeicoesExpandidas["ref-trainer-" + d.idDia + "-" + rIdx] ? "expandido" : ""}" id="corpo-ref-trainer-${d.idDia}-${rIdx}">
                            <div class="corpo-recolhivel-inner">
                                <div style="padding:0 10px 10px;">
                                    <table>
                                        <thead><tr><th>Alimento</th><th>Peso (g)</th><th>C (g)</th><th>P (g)</th><th>G (g)</th><th>Kcal</th><th>Del</th></tr></thead>
                                        <tbody>
                                            ${ref.alimentos
                                              .map(
                                                (al, aIdx) => `
                                                <tr>
                                                    <td><input type="text" class="input-inline" value="${al.nome}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos[${aIdx}].nome=this.value"></td>
                                                    <td><input type="number" class="input-inline" value="${al.quantidade}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos[${aIdx}].quantidade=Number(this.value); recalcularMacrosPorPesoDigitado(${dIdx},${rIdx},${aIdx});"></td>
                                                    <td><input type="number" step="0.1" class="input-inline" value="${al.carboTotal}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos[${aIdx}].carboTotal=Number(this.value); recalcularCaloriasAutomaticas(${dIdx},${rIdx},${aIdx});"></td>
                                                    <td><input type="number" step="0.1" class="input-inline" value="${al.protTotal}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos[${aIdx}].protTotal=Number(this.value); recalcularCaloriasAutomaticas(${dIdx},${rIdx},${aIdx});"></td>
                                                    <td><input type="number" step="0.1" class="input-inline" value="${al.gordTotal}" onchange="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos[${aIdx}].gordTotal=Number(this.value); recalcularCaloriasAutomaticas(${dIdx},${rIdx},${aIdx});"></td>
                                                    <td><input type="number" class="input-inline" value="${al.kcalTotal}" readonly style="opacity:0.5;"></td>
                                                    <td><button class="btn-remover" onclick="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes[${rIdx}].alimentos.splice(${aIdx},1); renderizarModoTreinador();"><i class="fa-solid fa-trash"></i></button></td>
                                                </tr>`,
                                              )
                                              .join("")}
                                        </tbody>
                                    </table>
                                    <div class="resumo-macros" style="margin-top:8px;margin-bottom:8px;">
                                        <div class="macro-box"><p>Kcal</p><div>${Math.round(ref.alimentos.reduce((s, al) => s + al.kcalTotal, 0))}</div></div>
                                        <div class="macro-box"><p>Carbo</p><div>${Math.round(ref.alimentos.reduce((s, al) => s + al.carboTotal, 0))}g</div></div>
                                        <div class="macro-box"><p>Prot</p><div>${Math.round(ref.alimentos.reduce((s, al) => s + al.protTotal, 0))}g</div></div>
                                        <div class="macro-box"><p>Gord</p><div>${Math.round(ref.alimentos.reduce((s, al) => s + al.gordTotal, 0))}g</div></div>
                                    </div>
                                    <button class="btn btn-add" style="background:#1e293b;" onclick="abrirModalAlimentosParaRefeicao(${dIdx}, ${rIdx})"><i class="fa-solid fa-basket-shopping"></i> Buscar Alimento na Referência</button>
                                </div>
                            </div>
                        </div>
                    </div>`,
                  )
                  .join("")}
                <button class="btn btn-add" onclick="dadosDoAluno.rotinasDieta[${dIdx}].refeicoes.push({nomeRefeicao:'Nova Refeição',alimentos:[]}); renderizarModoTreinador();">+ Nova Refeição</button>
              </div>
            </div>
        </div>`,
      )
      .join("");
}

// --- MODAIS DE BIBLIOTECA (EXERCÍCIOS / ALIMENTOS) ---
function abrirModalBibliotecaParaBloco(idB) {
  modoGerenciamentoBancoAtivo = false;
  blocoAlvoParaAdicionarExercicio = idB;

  const modalHeader = document.querySelector(
    "#modalBiblioteca .modal-header h3",
  );
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fa-solid fa-folder-open" style="color: var(--cor-neon);"></i> Selecione o Exercício`;
  }

  let ag = {};
  bibliotecaCompleta.forEach((e) => {
    if (!ag[e.musculo]) ag[e.musculo] = [];
    ag[e.musculo].push(e);
  });
  document.getElementById("modalBodyPastas").innerHTML = Object.keys(ag)
    .map(
      (m, i) => `
        <div class="pasta-musculo" onclick="alternarAcordeaoPasta('p_ex_${i}')"><i class="fa-solid fa-folder" style="color:#f59e0b;"></i> ${m} (${ag[m].length})</div>
        <div class="lista-exercicios-pasta" id="p_ex_${i}">
          <div class="lista-exercicios-pasta-inner">
            ${ag[m]
              .map((ex) => {
                const nomeEsc = ex.nome_exercicio.replace(/'/g, "\\'");
                const gifEsc = (ex.gif_url || "").replace(/'/g, "\\'");
                return `<div class="item-exercicio-biblioteca" onclick="injetarExercicio('${nomeEsc}','${gifEsc}')" onmouseenter="mostrarPreviewExercicio('${nomeEsc}','${gifEsc}',event)" onmouseleave="esconderPreviewExercicio()">${ex.nome_exercicio} <i class="fa-solid fa-plus" style="color:var(--verde);"></i></div>`;
              })
              .join("")}
          </div>
        </div>`,
    )
    .join("");
  document.getElementById("modalBiblioteca").style.display = "flex";
}
function mostrarPreviewExercicio(nome, gifUrl, e) {
  const preview = document.getElementById("previewExercicioGif");
  const conteudo = document.getElementById("previewGifConteudo");
  const nomeEl = document.getElementById("previewGifNome");
  if (!preview || !conteudo || !nomeEl) return;

  nomeEl.textContent = nome;

  if (gifUrl) {
    if (gifUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
      conteudo.innerHTML = `<img src="${gifUrl}" alt="${nome}" style="width:100%;border-radius:6px;" />`;
    } else {
      conteudo.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 10px;gap:10px;color:var(--texto-mutado);">
          <i class="fa-solid fa-play-circle" style="font-size:36px;color:var(--cor-neon);"></i>
          <span style="font-size:13px;">GIF disponível — clique para abrir</span>
        </div>`;
    }
  } else {
    conteudo.innerHTML = `<div style="color:var(--texto-mutado);text-align:center;padding:30px 10px;font-size:13px;">Sem GIF disponível</div>`;
  }

  preview.style.display = "block";

  // Posiciona ao lado do elemento (position: fixed)
  const rect = e.target.getBoundingClientRect();
  let top = rect.top;
  let left = rect.right + 15;

  // Se não couber à direita, mostra à esquerda
  if (left + 230 > window.innerWidth) {
    left = rect.left - 230;
  }
  // Se não couber em cima/baixo, ajusta
  if (top + 300 > window.innerHeight) {
    top = window.innerHeight - 310;
  }
  if (top < 10) top = 10;

  preview.style.top = top + "px";
  preview.style.left = left + "px";
}

function esconderPreviewExercicio() {
  const preview = document.getElementById("previewExercicioGif");
  if (preview) preview.style.display = "none";
}

function fecharModalBiblioteca() {
  document.getElementById("modalBiblioteca").style.display = "none";
  modoGerenciamentoBancoAtivo = false;
  esconderPreviewExercicio();
}

function injetarExercicio(n, g) {
  let b = dadosDoAluno.rotinasTreino.find(
    (x) => x.idBloco === blocoAlvoParaAdicionarExercicio,
  );
  if (b)
    b.exercicios.push({
      id: "ex_" + Date.now(),
      nome: n,
      series: "4",
      reps: "10",
      descanso: '60"',
      gif_url: g,
    });
  fecharModalBiblioteca();
  renderizarModoTreinador();
}

// === EXERCÍCIOS CONJUGADOS ===

let blocoConjugarAlvo = null; // { bIdx, eIdx }

function abrirModalBibliotecaParaConjugar(bIdx, eIdx) {
  blocoConjugarAlvo = { bIdx, eIdx };

  const modalHeader = document.querySelector(
    "#modalBiblioteca .modal-header h3",
  );
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fa-solid fa-link" style="color: var(--cor-neon);"></i> Selecionar Exercício Conjugado`;
  }

  let ag = {};
  bibliotecaCompleta.forEach((e) => {
    if (!ag[e.musculo]) ag[e.musculo] = [];
    ag[e.musculo].push(e);
  });
  document.getElementById("modalBodyPastas").innerHTML = Object.keys(ag)
    .map(
      (m, i) => `
        <div class="pasta-musculo" onclick="alternarAcordeaoPasta('p_ex_conj_${i}')"><i class="fa-solid fa-folder" style="color:#f59e0b;"></i> ${m} (${ag[m].length})</div>
        <div class="lista-exercicios-pasta" id="p_ex_conj_${i}">
          <div class="lista-exercicios-pasta-inner">
            ${ag[m]
              .map((ex) => {
                const nomeEsc = ex.nome_exercicio.replace(/'/g, "\\'");
                const gifEsc = (ex.gif_url || "").replace(/'/g, "\\'");
                return `<div class="item-exercicio-biblioteca" onclick="injetarExercicioConjugado('${nomeEsc}','${gifEsc}')" onmouseenter="mostrarPreviewExercicio('${nomeEsc}','${gifEsc}',event)" onmouseleave="esconderPreviewExercicio()">${ex.nome_exercicio} <i class="fa-solid fa-plus" style="color:var(--verde);"></i></div>`;
              })
              .join("")}
          </div>
        </div>`,
    )
    .join("");
  document.getElementById("modalBiblioteca").style.display = "flex";
}

function injetarExercicioConjugado(n, g) {
  if (!blocoConjugarAlvo) {
    fecharModalBiblioteca();
    return;
  }
  const { bIdx, eIdx } = blocoConjugarAlvo;
  const ex = dadosDoAluno.rotinasTreino[bIdx]?.exercicios[eIdx];
  if (ex) {
    ex.nome2 = n;
    ex.gif_url2 = g;
  }
  blocoConjugarAlvo = null;
  fecharModalBiblioteca();
  renderizarModoTreinador();
}

function removerExercicioConjugado(bIdx, eIdx) {
  const ex = dadosDoAluno.rotinasTreino[bIdx]?.exercicios[eIdx];
  if (ex) {
    ex.nome2 = "";
    ex.gif_url2 = "";
  }
  renderizarModoTreinador();
}

function abrirModalAlimentosParaRefeicao(diaIdx, refIdx) {
  modoGerenciamentoBancoAtivo = false;
  dietaAlvoIndices = { diaIdx, refIdx };

  const modalHeader = document.querySelector(
    "#modalAlimentosRef .modal-header h3",
  );
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fa-solid fa-basket-shopping" style="color: var(--cor-neon);"></i> Selecione o Alimento por Macro`;
  }

  let ag = {};
  bibliotecaAlimentosCompleta.forEach((al) => {
    let cat = al.tipo_macro || "Carbo";
    if (!ag[cat]) ag[cat] = [];
    ag[cat].push(al);
  });
  document.getElementById("modalBodyPastasAlimentos").innerHTML = Object.keys(
    ag,
  )
    .map(
      (macro, i) => `
        <div class="pasta-musculo" onclick="alternarAcordeaoPasta('p_al_${i}')">
            <i class="fa-solid fa-folder" style="color:#10b981;"></i> ${macro} (${ag[macro].length})
        </div>
        <div class="lista-exercicios-pasta" id="p_al_${i}">
          <div class="lista-exercicios-pasta-inner">
            ${ag[macro]
              .map(
                (al) => `
                <div class="item-exercicio-biblioteca" onclick="injetarAlimentoReferencia('${al.id}')">
                    <span>${al.nome_alimento} <small style="color:var(--texto-mutado);">(${al.quantidade_padrao})</small></span>
                    <i class="fa-solid fa-circle-plus" style="color:var(--cor-neon);"></i>
                </div>`,
              )
              .join("")}
          </div>
        </div>`,
    )
    .join("");
  document.getElementById("modalAlimentosRef").style.display = "flex";
}
function fecharModalAlimentosRef() {
  document.getElementById("modalAlimentosRef").style.display = "none";
  modoGerenciamentoBancoAtivo = false;
}

function injetarAlimentoReferencia(alimentoId) {
  const al = bibliotecaAlimentosCompleta.find((item) => item.id === alimentoId);
  if (!al) return;

  const { diaIdx, refIdx } = dietaAlvoIndices;
  if (diaIdx !== null && refIdx !== null) {
    dadosDoAluno.rotinasDieta[diaIdx].refeicoes[refIdx].alimentos.push({
      id: "al_" + Date.now(),
      nome: al.nome_alimento,
      quantidade: al.quantidade_padrao,
      carboTotal: al.carbo_padrao,
      protTotal: al.prot_padrao,
      gordTotal: al.gord_padrao,
      kcalTotal: al.kcal_padrao,
      porcaoBase: al.quantidade_padrao,
      carboBase: al.carbo_padrao,
      protBase: al.prot_padrao,
      gordBase: al.gord_padrao,
    });
  }
  fecharModalAlimentosRef();
  renderizarModoTreinador();
}

// --- SALVAR ALTERAÇÕES (SINCRO BANCO) ---
async function salvarAlteracoesNoBanco() {
  if (!alunoIdSelecionado) return;
  alert("Sincronizando dados...");

  // Sincronizar Treinos
  await _supabase
    .from("treinos_blocos")
    .delete()
    .eq("aluno_id", alunoIdSelecionado);
  for (let [i, b] of dadosDoAluno.rotinasTreino.entries()) {
    let { data: nb } = await _supabase
      .from("treinos_blocos")
      .insert({
        aluno_id: alunoIdSelecionado,
        nome_bloco: b.nomeBloco,
        ordem: i,
      })
      .select()
      .single();
    if (nb && b.exercicios.length > 0) {
      // CORREÇÃO AQUI: adicionado o index (idx) mapeando para a coluna 'ordem'
      await _supabase.from("treinos_exercicios").insert(
        b.exercicios.map((e, idx) => ({
          bloco_id: nb.id,
          nome: e.nome,
          series: e.series,
          reps: e.reps,
          descanso: e.descanso,
          gif_url: e.gif_url,
          nome2: e.nome2 || null,
          gif_url2: e.gif_url2 || null,
          ordem: idx,
        })),
      );
    }
  }

  // Sincronizar Dietas
  await _supabase
    .from("dieta_dias")
    .delete()
    .eq("aluno_id", alunoIdSelecionado);
  for (let [i, d] of dadosDoAluno.rotinasDieta.entries()) {
    let { data: nd } = await _supabase
      .from("dieta_dias")
      .insert({ aluno_id: alunoIdSelecionado, nome_dia: d.nomeDia, ordem: i })
      .select()
      .single();
    if (nd) {
      let inserts = [];
      d.refeicoes.forEach((r) => {
        r.alimentos.forEach((al) => {
          let q = al.quantidade || 1;
          inserts.push({
            dia_id: nd.id,
            nome_refeicao: r.nomeRefeicao,
            nome_alimento: al.nome,
            quantidade: q,
            carbo_g: al.carboTotal / q,
            prot_g: al.protTotal / q,
            gord_g: al.gordTotal / q,
            kcal_g: al.kcalTotal / q,
          });
        });
      });
      if (inserts.length > 0)
        await _supabase.from("dieta_alimentos").insert(inserts);
    }
  }
  alert("Salvo com sucesso!");
  document.getElementById("btnEditar").click();
  await puxarDadosDoAlunoDoBanco();
}

function trocarAlunoNoPainel(id) {
  alunoIdSelecionado = id;
  // Aplica o tema do aluno selecionado (para treinador visualizar)
  const al = listaGlobalAlunosCompleta.find((a) => a.id === id);
  if (al) aplicarTemaPorSexo(al.sexo);
  puxarDadosDoAlunoDoBanco();
}

// --- CONTROLE DE IFRAME / VISUALIZAÇÃO DE VIDEOS/GIFS ---
function gerenciarAnimacaoGif(url) {
  const c = document.getElementById("containerGif");
  const ifr = document.getElementById("videoIframe");

  c.style.transition =
    "max-height 0.5s ease-in-out, opacity 0.5s ease-in-out, transform 0.5s ease-in-out, padding 0.5s ease-in-out";
  c.style.overflow = "hidden";

  if (gifAtualSendoExibido === url) {
    fecharIframeSuave();
    return;
  }

  if (gifAtualSendoExibido !== "" && c.style.opacity === "1") {
    c.style.opacity = "0";
    c.style.transform = "translateY(15px)";
    setTimeout(() => {
      if (ifr) ifr.src = url;
      gifAtualSendoExibido = url;
      c.style.opacity = "1";
      c.style.transform = "translateY(0)";
      c.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 200);
  } else {
    if (ifr) ifr.src = url;
    gifAtualSendoExibido = url;
    c.style.maxHeight = "0px";
    c.style.opacity = "0";
    c.style.transform = "translateY(40px)";
    c.style.display = "block";
    c.offsetHeight;
    c.style.maxHeight = "500px";
    c.style.opacity = "1";
    c.style.transform = "translateY(0)";
    c.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function fecharIframeSuave() {
  const c = document.getElementById("containerGif");
  const ifr = document.getElementById("videoIframe");
  if (!c || gifAtualSendoExibido === "") return;

  c.style.transition =
    "max-height 0.5s ease-in-out, opacity 0.5s ease-in-out, transform 0.5s ease-in-out, padding 0.5s ease-in-out";
  c.style.maxHeight = "0px";
  c.style.opacity = "0";
  c.style.transform = "translateY(40px)";
  setTimeout(() => {
    if (ifr) ifr.src = "";
    gifAtualSendoExibido = "";
  }, 500);
}

function fecharIframeImediato() {
  const c = document.getElementById("containerGif");
  if (c) {
    c.style.transition = "none";
    c.style.maxHeight = "0px";
    c.style.opacity = "0";
    c.style.transform = "translateY(40px)";
  }
  const ifr = document.getElementById("videoIframe");
  if (ifr) ifr.src = "";
  gifAtualSendoExibido = "";
}

// --- CONFIGURAÇÕES DE INTERRUPTORES E ABAS ---
function configureAbas() {
  document.querySelectorAll(".menu-abas .aba-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".menu-abas .aba-link")
        .forEach((b) => b.classList.remove("ativa"));
      document
        .querySelectorAll(".conteudo-aba")
        .forEach((c) => c.classList.remove("ativa"));
      btn.classList.add("ativa");
      document.getElementById(btn.dataset.aba).classList.add("ativa");
      fecharIframeImediato();
      renderizarInterface();
    });
  });
}

document
  .getElementById("btn-novo-bloco-treino")
  .addEventListener("click", () => {
    dadosDoAluno.rotinasTreino.push({
      idBloco: "n_" + Date.now(),
      nomeBloco: "Novo Bloco Treino",
      exercicios: [],
    });
    renderizarModoTreinador();
  });

document.getElementById("btn-novo-dia-dieta").addEventListener("click", () => {
  dadosDoAluno.rotinasDieta.push({
    idDia: "nd_" + Date.now(),
    nomeDia: "Novo Protocolo",
    refeicoes: [],
  });
  renderizarModoTreinador();
});

document.getElementById("btnEditar").addEventListener("click", () => {
  modoEdicaoAtivo = !modoEdicaoAtivo;
  const btn = document.getElementById("btnEditar");
  const idsBotoesAdmin = [
    "btnSalvar",
    "btnGerenciarAlunos",
    "btn-novo-bloco-treino",
    "btn-novo-dia-dieta",
  ];

  if (modoEdicaoAtivo) {
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Sair da Edição';
    btn.style.background = "#4b5563";
    idsBotoesAdmin.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "flex";
    });
    document
      .querySelectorAll(".btn-admin-acao")
      .forEach((el) => (el.style.display = "flex"));
    estadosRefeicoesExpandidas = {};
    renderizarModoTreinador();
  } else {
    btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Ativar Edição';
    btn.style.background = "#3b82f6";
    idsBotoesAdmin.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    document
      .querySelectorAll(".btn-admin-acao")
      .forEach((el) => (el.style.display = "none"));
    renderizarModoAluno();
  }
});

// --- COMPARACAO DE EVOLUCAO ---
async function carregarFeedbacksEvolucao() {
  const alunoId =
    currentUser.role === "aluno" ? currentUser.alunoId : alunoIdSelecionado;
  if (!alunoId) return;

  const { data, error } = await _supabase
    .from("evolucao_feedbacks")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("Erro ao carregar feedbacks:", error);
    return;
  }

  feedbacksEvolucao = data || [];
}

function abrirModalEvolucao() {
  document.getElementById("modalEvolucao").style.display = "flex";
  carrosselAnguloAtual = "frente";
  carrosselPaginaAtual = 0;
  renderizarTrackCompleto();
}

function fecharModalEvolucao() {
  document.getElementById("modalEvolucao").style.display = "none";
}

function mudarAnguloComparacao(posicao) {
  carrosselAnguloAtual = posicao;
  carrosselPaginaAtual = 0;
  renderizarTrackCompleto();
}

function moverCarrossel(direcao) {
  const posicao = carrosselAnguloAtual;
  const chaveFoto = {
    frente: "foto_frente",
    lado_esq: "foto_lado_esq",
    costas: "foto_costas",
    lado_dir: "foto_lado_dir",
  };
  const fotos = feedbacksEvolucao.filter((f) => f[chaveFoto[posicao]]);

  const total = fotos.length;
  if (total === 0) return;

  const totalPaginas = Math.max(1, total - 1);
  carrosselPaginaAtual = Math.max(
    0,
    Math.min(carrosselPaginaAtual + direcao, totalPaginas - 1),
  );
  atualizarCarrossel();
}

function renderizarTrackCompleto() {
  const track = document.getElementById("carrossel-track");
  if (!track) return;

  const posicao = carrosselAnguloAtual;
  const nomes = {
    frente: "Frente",
    lado_esq: "Lado Esquerdo",
    costas: "Costas",
    lado_dir: "Lado Direito",
  };
  const chaveFoto = {
    frente: "foto_frente",
    lado_esq: "foto_lado_esq",
    costas: "foto_costas",
    lado_dir: "foto_lado_dir",
  };

  const fotos = feedbacksEvolucao
    .filter((f) => f[chaveFoto[posicao]])
    .map((f) => ({ url: f[chaveFoto[posicao]], data: f.criado_em }));

  if (fotos.length === 0) {
    track.innerHTML = `<div style="color:var(--texto-mutado);text-align:center;padding:40px 10px;flex:0 0 100%;width:100%;box-sizing:border-box;">Nenhuma foto de <strong>${nomes[posicao]}</strong> encontrada.</div>`;
    track.style.transform = "translateX(0)";
    const info = document.getElementById("carrossel-info");
    if (info) info.textContent = "";
    document.getElementById("btn-carrossel-esq").style.opacity = "0.3";
    document.getElementById("btn-carrossel-dir").style.opacity = "0.3";
    return;
  }

  const viewport = document.getElementById("carrossel-viewport");
  const cardWidth = Math.floor((viewport.clientWidth - CARROSSEL_GAP) / 2);
  carrosselLarguraCard = cardWidth;

  track.innerHTML = fotos
    .map((f) => {
      const dataFormatada = new Date(f.data).toLocaleDateString("pt-BR");
      return `
        <div style="flex:0 0 ${cardWidth}px;width:${cardWidth}px;display:flex;flex-direction:column;align-items:center;gap:6px;box-sizing:border-box;">
          <div style="width:100%;aspect-ratio:9/16;display:flex;align-items:center;justify-content:center;background:#111827;border-radius:8px;border:2px solid #3b82f6;overflow:hidden;">
            <img src="${f.url}" style="max-width:100%;max-height:100%;object-fit:contain;" />
          </div>
          <span style="color:var(--texto-mutado);font-size:11px;">${dataFormatada}</span>
        </div>`;
    })
    .join("");

  carrosselPaginaAtual = 0;
  atualizarCarrossel();

  // Adiciona swipe para celular (uma vez apenas)
  if (!viewport.dataset.swipeAtivo) {
    viewport.dataset.swipeAtivo = "1";
    let touchStartX = 0;
    viewport.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true },
    );
    viewport.addEventListener("touchend", (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        moverCarrossel(diff > 0 ? 1 : -1);
      }
    });
  }
}

const CARROSSEL_GAP = 10;

function atualizarCarrossel() {
  const track = document.getElementById("carrossel-track");
  if (!track) return;

  const posicao = carrosselAnguloAtual;
  const chaveFoto = {
    frente: "foto_frente",
    lado_esq: "foto_lado_esq",
    costas: "foto_costas",
    lado_dir: "foto_lado_dir",
  };
  const fotos = feedbacksEvolucao.filter((f) => f[chaveFoto[posicao]]);
  const total = fotos.length;
  if (total === 0) return;

  const cardWidth =
    carrosselLarguraCard ||
    Math.floor(
      (document.getElementById("carrossel-viewport").clientWidth -
        CARROSSEL_GAP) /
        2,
    );
  const passo = cardWidth + CARROSSEL_GAP;
  track.style.transform = "translateX(-" + carrosselPaginaAtual * passo + "px)";

  // Info: mostra qual par esta visivel
  const inicio = carrosselPaginaAtual;
  const fim = Math.min(inicio + 2, total);
  const info = document.getElementById("carrossel-info");
  if (info) {
    if (total === 1) {
      const data = new Date(fotos[0].criado_em).toLocaleDateString("pt-BR");
      info.textContent = "1 de 1 — " + data;
    } else {
      const data = new Date(fotos[inicio].criado_em).toLocaleDateString(
        "pt-BR",
      );
      info.textContent = inicio + 1 + "-" + fim + " de " + total + " — " + data;
    }
  }

  // Visibilidade das setas
  const totalPaginas = Math.max(1, total - 1);
  document.getElementById("btn-carrossel-esq").style.opacity =
    carrosselPaginaAtual === 0 ? "0.3" : "1";
  document.getElementById("btn-carrossel-dir").style.opacity =
    carrosselPaginaAtual >= totalPaginas - 1 ? "0.3" : "1";
}
