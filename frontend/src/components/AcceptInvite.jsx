import { useEffect, useState } from 'react';
import { auth } from '../api/client.js';
import { LogoMark } from './Logo.jsx';

const ABA_LABELS = {
  conteudo: 'Conteúdo',
  tarefas:  'Tarefas',
  agenda:   'Agenda',
  notas:    'Notas'
};

export default function AcceptInvite({ token }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await auth.conviteInfo(token);
        if (!cancelled) setInfo(r);
      } catch (e) {
        if (!cancelled) setErro(e?.message || 'Convite inválido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAccept(e) {
    e.preventDefault();
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== senha2) {
      setErro('As senhas não conferem.');
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await auth.conviteAceitar(token, senha);
      setOk(true);
      // Redireciona para a raiz após 1.5s
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (e) {
      setErro(e?.message || 'Erro ao aceitar convite');
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <p className="invite-msg">Carregando…</p>
        </div>
      </div>
    );
  }

  if (erro && !info) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo"><LogoMark size={48} /></div>
          <h1 className="invite-title">Convite inválido</h1>
          <p className="invite-sub">{erro}</p>
        </div>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo"><LogoMark size={48} /></div>
          <h1 className="invite-title">Bem-vindo(a) ao SpaceSystem!</h1>
          <p className="invite-sub">Conta criada com sucesso. Redirecionando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <form className="invite-card" onSubmit={handleAccept}>
        <div className="invite-logo"><LogoMark size={48} /></div>
        <h1 className="invite-title">Você foi convidado(a)</h1>
        <p className="invite-sub">
          <strong>{info.criador_nome}</strong> está te convidando para colaborar no SpaceSystem.
        </p>

        <div className="invite-info-grid">
          <div>
            <span className="invite-info-label">Nome</span>
            <span className="invite-info-value">{info.nome}</span>
          </div>
          <div>
            <span className="invite-info-label">E-mail</span>
            <span className="invite-info-value">{info.email}</span>
          </div>
          <div>
            <span className="invite-info-label">Permissão</span>
            <span className="invite-info-value">
              {info.permissao === 'editar' ? 'Editar' : 'Visualizar'}
            </span>
          </div>
          <div>
            <span className="invite-info-label">Áreas</span>
            <span className="invite-info-value">
              {(info.abas_acesso || []).map((a) => ABA_LABELS[a] || a).join(', ') || '—'}
            </span>
          </div>
        </div>

        <div className="field field-full" style={{ marginTop: 18 }}>
          <label>Defina uma senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
            autoFocus
          />
        </div>
        <div className="field field-full">
          <label>Confirme a senha</label>
          <input
            type="password"
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
            placeholder="Digite novamente"
            minLength={6}
            required
          />
        </div>

        {erro && <div className="auth-error" style={{ marginTop: 10 }}>{erro}</div>}

        <button type="submit" className="btn btn-primary invite-btn" disabled={busy}>
          {busy ? 'Aceitando…' : 'Aceitar convite e entrar'}
        </button>

        <p className="invite-foot">
          Ao aceitar você concorda em criar uma conta no SpaceSystem com acesso restrito às áreas listadas.
        </p>
      </form>
    </div>
  );
}
