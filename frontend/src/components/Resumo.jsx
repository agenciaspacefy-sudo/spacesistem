import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { monthLabel } from '../utils.js';
import { useFormatBRL } from '../PrivacyContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import { generateMonthlyReport } from '../reportPdf.js';
import RevenueChart from './RevenueChart.jsx';

export default function Resumo({ mesFiltro }) {
  const fmtBRL = useFormatBRL();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.resumo());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtradas = useMemo(() => {
    if (!mesFiltro) return rows;
    return rows.filter((r) => r.mes === mesFiltro);
  }, [rows, mesFiltro]);

  const totais = useMemo(() => {
    const receita = filtradas.reduce((s, r) => s + r.receita, 0);
    const gastos = filtradas.reduce((s, r) => s + r.gastos, 0);
    const lucro = receita - gastos;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    return { receita, gastos, lucro, margem };
  }, [filtradas]);

  async function handleExportPdf() {
    setExporting(true);
    try {
      // Se há filtro de mês, busca detalhamentos daquele mês; senão passa vazio.
      const [recs, gas] = mesFiltro
        ? await Promise.all([
            api.listRecebimentos(mesFiltro).catch(() => []),
            api.listGastos(mesFiltro).catch(() => [])
          ])
        : [[], []];
      generateMonthlyReport({
        resumoRows: rows,
        recebimentos: recs,
        gastos: gas,
        mesFiltro,
        settings
      });
    } catch (e) {
      alert('Erro ao gerar PDF: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Receita recebida</div>
          <div className="card-value pos">{fmtBRL(totais.receita)}</div>
        </div>
        <div className="card">
          <div className="card-label">Total gastos</div>
          <div className="card-value neg">{fmtBRL(totais.gastos)}</div>
        </div>
        <div className="card">
          <div className="card-label">Lucro líquido</div>
          <div className={`card-value ${totais.lucro >= 0 ? 'pos' : 'neg'}`}>{fmtBRL(totais.lucro)}</div>
        </div>
        <div className="card">
          <div className="card-label">Margem</div>
          <div className={`card-value ${totais.margem >= 0 ? 'pos' : 'neg'}`}>
            {totais.margem.toFixed(1).replace('.', ',')}%
          </div>
        </div>
      </div>

      <RevenueChart resumo={rows} />

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">
            {mesFiltro
              ? `Mostrando ${monthLabel(mesFiltro)}`
              : `${filtradas.length} mês${filtradas.length === 1 ? '' : 'es'} com movimento`}
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn" onClick={load}>
            Atualizar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportPdf}
            disabled={exporting || rows.length === 0}
            title="Exporta relatório em PDF"
          >
            {exporting ? 'Gerando…' : '↓ Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="right">Receita recebida</th>
              <th className="right">Total gastos</th>
              <th className="right">Lucro líquido</th>
              <th className="right">Margem</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">Carregando…</div>
                </td>
              </tr>
            )}
            {!loading && filtradas.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">Nenhum lançamento ainda.</div>
                </td>
              </tr>
            )}
            {!loading &&
              filtradas.map((r) => {
                const margemCls = r.margem >= 0 ? 'pos' : 'neg';
                const lucroCls = r.lucro >= 0 ? 'pos' : 'neg';
                return (
                  <tr key={r.mes}>
                    <td>
                      <div className="cell">{monthLabel(r.mes)}</div>
                    </td>
                    <td>
                      <div className="cell mono" style={{ justifyContent: 'flex-end' }}>
                        {fmtBRL(r.receita)}
                      </div>
                    </td>
                    <td>
                      <div className="cell mono" style={{ justifyContent: 'flex-end' }}>
                        {fmtBRL(r.gastos)}
                      </div>
                    </td>
                    <td>
                      <div className={`cell mono ${lucroCls}`} style={{ justifyContent: 'flex-end' }}>
                        {fmtBRL(r.lucro)}
                      </div>
                    </td>
                    <td>
                      <div className={`cell mono ${margemCls}`} style={{ justifyContent: 'flex-end' }}>
                        {r.margem.toFixed(1).replace('.', ',')}%
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
          {filtradas.length > 1 && (
            <tfoot>
              <tr>
                <td>
                  <div className="cell" style={{ fontWeight: 600 }}>
                    Total
                  </div>
                </td>
                <td>
                  <div className="cell mono pos" style={{ justifyContent: 'flex-end', fontWeight: 600 }}>
                    {fmtBRL(totais.receita)}
                  </div>
                </td>
                <td>
                  <div className="cell mono neg" style={{ justifyContent: 'flex-end', fontWeight: 600 }}>
                    {fmtBRL(totais.gastos)}
                  </div>
                </td>
                <td>
                  <div
                    className={`cell mono ${totais.lucro >= 0 ? 'pos' : 'neg'}`}
                    style={{ justifyContent: 'flex-end', fontWeight: 600 }}
                  >
                    {fmtBRL(totais.lucro)}
                  </div>
                </td>
                <td>
                  <div
                    className={`cell mono ${totais.margem >= 0 ? 'pos' : 'neg'}`}
                    style={{ justifyContent: 'flex-end', fontWeight: 600 }}
                  >
                    {totais.margem.toFixed(1).replace('.', ',')}%
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
