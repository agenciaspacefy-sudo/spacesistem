import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

const AVATAR_SIZE = 200;
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB de imagem original

// Lê um File como dataURL e retorna um HTMLImageElement carregado
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Recorta para quadrado e redimensiona para AVATAR_SIZE x AVATAR_SIZE
async function resizeToAvatar(file) {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // JPEG 0.85 dá ~10-25KB para um avatar comum
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function ProfileModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [nome, setNome] = useState(user?.nome || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [original, setOriginal] = useState({ nome: user?.nome || '', avatar: user?.avatar || null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef(null);

  // Esc fecha
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (user) {
      setNome(user.nome || '');
      setAvatar(user.avatar || null);
      setOriginal({ nome: user.nome || '', avatar: user.avatar || null });
    }
  }, [user]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro('');
    if (!/^image\/(jpe?g|png)$/i.test(file.type)) {
      setErro('Use uma imagem JPG ou PNG.');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setErro('A imagem é muito grande. Use até 8 MB.');
      return;
    }
    try {
      const dataUrl = await resizeToAvatar(file);
      setAvatar(dataUrl);
    } catch (err) {
      setErro('Não foi possível processar a imagem.');
    } finally {
      // Limpa para permitir selecionar o mesmo arquivo novamente
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleRemoveAvatar() {
    setAvatar(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) {
      setErro('O nome é obrigatório.');
      return;
    }
    const patch = {};
    if (nome.trim() !== original.nome) patch.nome = nome.trim();
    if (avatar !== original.avatar) patch.avatar = avatar;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSalvando(true);
    try {
      await updateProfile(patch);
      onClose();
    } catch (err) {
      setErro(err.message || 'Falha ao salvar perfil.');
    } finally {
      setSalvando(false);
    }
  }

  const inicial = (nome || user?.email || '?').trim().charAt(0).toUpperCase();
  const dirty =
    nome.trim() !== original.nome ||
    avatar !== original.avatar;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal profile-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h3 className="modal-title">Meu perfil</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body">
          <div className="profile-avatar-row">
            <div className="profile-avatar-preview" aria-hidden="true">
              {avatar
                ? <img src={avatar} alt="Foto de perfil" />
                : <span>{inicial}</span>}
            </div>
            <div className="profile-avatar-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => fileRef.current?.click()}
              >
                Trocar foto
              </button>
              {avatar && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-danger"
                  onClick={handleRemoveAvatar}
                >
                  Remover
                </button>
              )}
              <p className="profile-avatar-hint">JPG ou PNG · até 8&nbsp;MB · será redimensionada para {AVATAR_SIZE}×{AVATAR_SIZE}px.</p>
            </div>
          </div>

          <div className="field field-full" style={{ marginTop: 18 }}>
            <label>Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              autoFocus
              required
            />
          </div>

          <div className="field field-full" style={{ marginTop: 12 }}>
            <label>E-mail</label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              disabled
              className="profile-readonly"
            />
            <small className="hint">Não é possível alterar o e-mail por aqui.</small>
          </div>

          {erro && <div className="auth-error" style={{ marginTop: 12 }}>{erro}</div>}

          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando || !dirty}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
