import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp, Lightbulb, Upload, Settings, Menu, X,
  DollarSign, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, Search, Bell, ChevronRight, Plus, FileSpreadsheet, Users, Truck
} from "lucide-react";

const colors = {
  lavender: "#B8A9C9",
  lavenderLight: "#D4C8E2",
  lavenderPale: "#EDE7F4",
  sage: "#5C6B63",
  sageDark: "#4A5750",
  cream: "#FAF8F5",
  white: "#FFFFFF",
  warmGray: "#8B8680",
  charcoal: "#3D3935",
  rose: "#D4A0A0",
  gold: "#C9B97A",
  success: "#7FB88B",
  danger: "#D47B7B",
};

const revenueData = [
  { day: "01", value: 1200 }, { day: "05", value: 890 }, { day: "08", value: 2100 },
  { day: "12", value: 1650 }, { day: "15", value: 3200 }, { day: "18", value: 2800 },
  { day: "22", value: 1900 }, { day: "25", value: 4100 }, { day: "28", value: 3500 },
  { day: "30", value: 2700 },
];

const categoryData = [
  { name: "Collants", value: 35 }, { name: "Sapatilhas", value: 25 },
  { name: "Meias", value: 15 }, { name: "Acessórios", value: 12 },
  { name: "Figurinos", value: 13 },
];

const pieColors = [colors.lavender, colors.sage, colors.rose, colors.gold, colors.lavenderLight];

const topProducts = [
  { name: 'Collant Manga Longa Ballet', qty: 48, revenue: 'R$ 4.320' },
  { name: 'Sapatilha Meia-Ponta Capezio', qty: 35, revenue: 'R$ 5.250' },
  { name: 'Meia Calça Fio 40', qty: 62, revenue: 'R$ 1.860' },
  { name: 'Saia Tutu Infantil', qty: 28, revenue: 'R$ 2.240' },
  { name: 'Body Regata Adulto', qty: 31, revenue: 'R$ 2.170' },
];

const lowStockItems = [
  { name: 'Sapatilha Ponta Só Dança', stock: 2, min: 5, status: 'critical' },
  { name: 'Collant Cavado P Preto', stock: 3, min: 5, status: 'critical' },
  { name: 'Meia Calça Infantil M', stock: 4, min: 5, status: 'warning' },
  { name: 'Faixa de Cabelo Rosa', stock: 6, min: 10, status: 'warning' },
];

const recentSales = [
  { id: '#1247', time: '14:32', items: 3, total: 'R$ 289,00', method: 'PIX' },
  { id: '#1246', time: '13:15', items: 1, total: 'R$ 150,00', method: 'Cartão' },
  { id: '#1245', time: '11:48', items: 5, total: 'R$ 467,00', method: 'Dinheiro' },
  { id: '#1244', time: '10:22', items: 2, total: 'R$ 198,00', method: 'PIX' },
];

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Package, label: "Produtos", id: "products" },
  { icon: ShoppingCart, label: "Vendas", id: "sales" },
  { icon: Truck, label: "Pedidos", id: "orders" },
  { icon: Upload, label: "Importar", id: "upload" },
  { icon: TrendingUp, label: "Analytics", id: "analytics" },
  { icon: Lightbulb, label: "Insights", id: "insights" },
  { icon: Settings, label: "Configurações", id: "settings" },
];

const StatCard = ({ icon: Icon, label, value, change, changeType, color }) => (
  <div style={{
    background: colors.white, borderRadius: 16, padding: '24px', flex: 1, minWidth: 200,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: `1px solid ${colors.lavenderPale}`,
    transition: 'all 0.3s ease', cursor: 'pointer',
  }}
  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(184,169,201,0.15)'; }}
  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div style={{ background: color || colors.lavenderPale, borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={colors.sageDark} />
      </div>
      {change && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 500, color: changeType === 'up' ? colors.success : colors.danger }}>
          {changeType === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      )}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: -0.5 }}>
      {value}
    </div>
    <div style={{ fontSize: 13, color: colors.warmGray, marginTop: 4 }}>{label}</div>
  </div>
);

const PageProducts = () => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Produtos & Inventário</h2>
        <p style={{ color: colors.warmGray, fontSize: 14 }}>327 produtos cadastrados</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${colors.lavender}`, background: 'transparent', color: colors.sage, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <FileSpreadsheet size={16} /> Importar Planilha
        </button>
        <button style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: colors.lavender, color: colors.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> Novo Produto
        </button>
      </div>
    </div>
    <div style={{ background: colors.white, borderRadius: 16, border: `1px solid ${colors.lavenderPale}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', display: 'flex', gap: 12, borderBottom: `1px solid ${colors.lavenderPale}` }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: colors.cream, borderRadius: 10, padding: '10px 16px' }}>
          <Search size={16} color={colors.warmGray} />
          <span style={{ color: colors.warmGray, fontSize: 14 }}>Buscar por nome, SKU ou categoria...</span>
        </div>
        <select style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${colors.lavenderPale}`, background: colors.white, color: colors.charcoal, fontSize: 14 }}>
          <option>Todas Categorias</option>
        </select>
        <select style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${colors.lavenderPale}`, background: colors.white, color: colors.charcoal, fontSize: 14 }}>
          <option>Status: Todos</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.lavenderPale}` }}>
            {['', 'Produto', 'SKU', 'Categoria', 'Preço', 'Estoque', 'Status'].map(h => (
              <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: colors.warmGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { name: 'Collant Manga Longa Ballet', sku: 'COL-001', cat: 'Collants', price: 'R$ 89,90', stock: 24, status: 'Ativo' },
            { name: 'Sapatilha Meia-Ponta Capezio', sku: 'SAP-015', cat: 'Sapatilhas', price: 'R$ 149,90', stock: 8, status: 'Ativo' },
            { name: 'Meia Calça Fio 40 Ballet', sku: 'MEI-003', cat: 'Meias', price: 'R$ 29,90', stock: 62, status: 'Ativo' },
            { name: 'Sapatilha Ponta Só Dança', sku: 'SAP-022', cat: 'Sapatilhas', price: 'R$ 289,00', stock: 2, status: 'Estoque Baixo' },
            { name: 'Saia Tutu Infantil Rosa', sku: 'SAI-008', cat: 'Saias', price: 'R$ 79,90', stock: 15, status: 'Ativo' },
          ].map((p, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${colors.lavenderPale}`, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = colors.cream}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '14px 20px' }}>
                <input type="checkbox" style={{ accentColor: colors.lavender }} />
              </td>
              <td style={{ padding: '14px 20px', fontWeight: 500, color: colors.charcoal, fontSize: 14 }}>{p.name}</td>
              <td style={{ padding: '14px 20px', fontSize: 13, color: colors.warmGray, fontFamily: 'monospace' }}>{p.sku}</td>
              <td style={{ padding: '14px 20px' }}>
                <span style={{ background: colors.lavenderPale, color: colors.sage, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{p.cat}</span>
              </td>
              <td style={{ padding: '14px 20px', fontWeight: 600, color: colors.charcoal, fontSize: 14 }}>{p.price}</td>
              <td style={{ padding: '14px 20px', fontWeight: 600, color: p.stock <= 5 ? colors.danger : colors.charcoal, fontSize: 14 }}>{p.stock}</td>
              <td style={{ padding: '14px 20px' }}>
                <span style={{
                  background: p.status === 'Ativo' ? `${colors.success}20` : `${colors.danger}20`,
                  color: p.status === 'Ativo' ? colors.success : colors.danger,
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500
                }}>{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.lavenderPale}` }}>
        <span style={{ fontSize: 13, color: colors.warmGray }}>Mostrando 1-5 de 327 produtos</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, '...', 66].map((p, i) => (
            <button key={i} style={{ width: 36, height: 36, borderRadius: 8, border: p === 1 ? 'none' : `1px solid ${colors.lavenderPale}`, background: p === 1 ? colors.lavender : 'transparent', color: p === 1 ? colors.white : colors.charcoal, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PageUpload = () => {
  const [step, setStep] = useState(1);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 8 }}>Importar Planilha</h2>
      <p style={{ color: colors.warmGray, fontSize: 14, marginBottom: 32 }}>Atualize estoque e preços em massa ou cadastre novos produtos via planilha</p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, justifyContent: 'center' }}>
        {['Upload', 'Preview', 'Confirmar', 'Resultado'].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: i + 1 <= step ? colors.lavender : colors.lavenderPale, color: i + 1 <= step ? colors.white : colors.warmGray, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, transition: 'all 0.3s' }}>{i + 1}</div>
            <span style={{ fontSize: 14, fontWeight: i + 1 === step ? 600 : 400, color: i + 1 === step ? colors.charcoal : colors.warmGray }}>{s}</span>
            {i < 3 && <div style={{ width: 40, height: 2, background: i + 1 < step ? colors.lavender : colors.lavenderPale, borderRadius: 1 }} />}
          </div>
        ))}
      </div>
      {step === 1 && (
        <div style={{ background: colors.white, borderRadius: 16, border: `2px dashed ${colors.lavender}`, padding: 60, textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
          onMouseEnter={e => e.currentTarget.style.background = colors.lavenderPale + '40'}
          onMouseLeave={e => e.currentTarget.style.background = colors.white}
          onClick={() => setStep(2)}>
          <Upload size={48} color={colors.lavender} style={{ marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal, marginBottom: 8 }}>Arraste sua planilha aqui ou clique para selecionar</p>
          <p style={{ fontSize: 13, color: colors.warmGray, marginBottom: 20 }}>Formatos aceitos: .xlsx, .csv (máx. 5MB)</p>
          <button style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: colors.lavender, color: colors.white, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Selecionar Arquivo
          </button>
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${colors.lavenderPale}` }}>
            <a href="#" style={{ color: colors.lavender, fontSize: 13, textDecoration: 'none' }}>⬇ Baixar template de planilha</a>
          </div>
        </div>
      )}
      {step === 2 && (
        <div style={{ background: colors.white, borderRadius: 16, border: `1px solid ${colors.lavenderPale}`, padding: 32 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ background: `${colors.success}15`, padding: '12px 20px', borderRadius: 12, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: colors.success }}>12</div>
              <div style={{ fontSize: 12, color: colors.warmGray }}>Novos produtos</div>
            </div>
            <div style={{ background: `${colors.lavender}15`, padding: '12px 20px', borderRadius: 12, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: colors.lavender }}>45</div>
              <div style={{ fontSize: 12, color: colors.warmGray }}>Atualizações</div>
            </div>
            <div style={{ background: `${colors.danger}15`, padding: '12px 20px', borderRadius: 12, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: colors.danger }}>2</div>
              <div style={{ fontSize: 12, color: colors.warmGray }}>Erros</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.lavenderPale}` }}>
                {['Ação', 'SKU', 'Produto', 'Qtd Atual', 'Nova Qtd', 'Preço Atual', 'Novo Preço'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: colors.warmGray, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { action: 'Atualizar', sku: 'COL-001', name: 'Collant ML Ballet', oldQty: 24, newQty: 50, oldPrice: '89,90', newPrice: '94,90' },
                { action: 'Criar', sku: 'LEG-001', name: 'Legging Supplex P', oldQty: '-', newQty: 30, oldPrice: '-', newPrice: '69,90' },
                { action: 'Atualizar', sku: 'SAP-015', name: 'Sapatilha MP Capezio', oldQty: 8, newQty: 20, oldPrice: '149,90', newPrice: '149,90' },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.lavenderPale}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: r.action === 'Criar' ? `${colors.success}20` : `${colors.lavender}20`, color: r.action === 'Criar' ? colors.success : colors.lavender, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{r.action}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: colors.warmGray }}>{r.sku}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: colors.charcoal, fontSize: 13 }}>{r.name}</td>
                  <td style={{ padding: '12px 16px', color: colors.warmGray, fontSize: 13 }}>{r.oldQty}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: colors.charcoal, fontSize: 13 }}>{r.newQty}</td>
                  <td style={{ padding: '12px 16px', color: colors.warmGray, fontSize: 13 }}>R$ {r.oldPrice}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: r.oldPrice !== r.newPrice ? colors.gold : colors.charcoal, fontSize: 13 }}>R$ {r.newPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(1)} style={{ padding: '12px 24px', borderRadius: 10, border: `1px solid ${colors.lavenderPale}`, background: 'transparent', color: colors.charcoal, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
            <button onClick={() => setStep(1)} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: colors.lavender, color: colors.white, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Confirmar Importação</button>
          </div>
        </div>
      )}
    </div>
  );
};

const PageAnalytics = () => (
  <div>
    <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 24 }}>Analytics</h2>
    <div style={{ display: 'flex', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
      <StatCard icon={DollarSign} label="Faturamento Mensal" value="R$ 24.560" change="+18%" changeType="up" color={`${colors.success}20`} />
      <StatCard icon={ShoppingBag} label="Vendas no Mês" value="186" change="+12%" changeType="up" color={`${colors.lavender}30`} />
      <StatCard icon={TrendingUp} label="Ticket Médio" value="R$ 132" change="-3%" changeType="down" color={`${colors.gold}30`} />
      <StatCard icon={Package} label="Margem Média" value="42%" change="+2%" changeType="up" color={`${colors.rose}30`} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
      <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal, marginBottom: 20 }}>Faturamento — Últimos 30 dias</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.lavenderPale} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: colors.warmGray }} />
            <YAxis tick={{ fontSize: 12, fill: colors.warmGray }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => [`R$ ${value.toLocaleString()}`, 'Faturamento']} />
            <Line type="monotone" dataKey="value" stroke={colors.lavender} strokeWidth={3} dot={{ fill: colors.lavender, r: 4 }} activeDot={{ r: 6, fill: colors.sageDark }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal, marginBottom: 20 }}>Vendas por Categoria</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {categoryData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
            </Pie>
            <Tooltip formatter={(value) => [`${value}%`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {categoryData.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: pieColors[i] }} />
              <span style={{ color: colors.warmGray }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal, marginBottom: 20 }}>Top 5 Produtos por Faturamento</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={topProducts} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={colors.lavenderPale} />
          <XAxis type="number" tick={{ fontSize: 12, fill: colors.warmGray }} />
          <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 12, fill: colors.warmGray }} />
          <Tooltip />
          <Bar dataKey="qty" fill={colors.lavender} radius={[0, 6, 6, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const PageInsights = () => (
  <div>
    <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 8 }}>Insights</h2>
    <p style={{ color: colors.warmGray, fontSize: 14, marginBottom: 32 }}>Sugestões inteligentes baseadas nos seus dados de venda e estoque</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[
        { type: 'warning', icon: '🔥', title: 'Sapatilha Ponta Só Dança — estoque crítico!', desc: 'Apenas 2 unidades em estoque. Baseado no ritmo de vendas (4/semana), esse produto acaba em ~3 dias. Recomendamos abrir pedido de reposição agora.', action: 'Criar Pedido' },
        { type: 'success', icon: '📈', title: 'Collants tiveram crescimento de 32% este mês', desc: 'A categoria Collants vendeu 48 unidades este mês vs. 36 no mês anterior. Considere aumentar o estoque e destacar nas redes sociais.', action: 'Ver Detalhes' },
        { type: 'info', icon: '💡', title: 'Body Regata Adulto não vende há 15 dias', desc: 'Última venda em 22/03. Considere fazer uma promoção ou combo com outros produtos da mesma categoria.', action: 'Criar Promoção' },
        { type: 'info', icon: '📊', title: 'Melhor dia de vendas: Sábado (38% do faturamento)', desc: 'O horário de pico é entre 14h-17h. Considere reforçar a equipe nos sábados à tarde para melhor atendimento.', action: 'Ver Analytics' },
        { type: 'success', icon: '🎯', title: 'Ticket médio subiu R$12 com combos de meia + sapatilha', desc: 'Clientes que levam sapatilha têm 72% de chance de levar meia junto. Sugestão: criar kit "Pés de Bailarina" com desconto.', action: 'Ver Detalhes' },
      ].map((insight, i) => (
        <div key={i} style={{
          background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}`,
          borderLeft: `4px solid ${insight.type === 'warning' ? colors.danger : insight.type === 'success' ? colors.success : colors.lavender}`,
          transition: 'all 0.2s', cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.charcoal, marginBottom: 8 }}>{insight.icon} {insight.title}</div>
              <div style={{ fontSize: 13, color: colors.warmGray, lineHeight: 1.6 }}>{insight.desc}</div>
            </div>
            <button style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${colors.lavenderPale}`, background: 'transparent', color: colors.sage, cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 16 }}>{insight.action}</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function LumineDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: colors.cream, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 72, background: colors.white, borderRight: `1px solid ${colors.lavenderPale}`,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", position: 'relative', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: sidebarOpen ? '24px 20px' : '24px 14px', display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${colors.lavenderPale}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${colors.lavender}, ${colors.lavenderLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: colors.white }}>L</span>
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: 1 }}>LUMINE</div>
              <div style={{ fontSize: 10, color: colors.warmGray, letterSpacing: 2, fontStyle: 'italic' }}>Lumine</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: sidebarOpen ? "12px 16px" : "12px",
                borderRadius: 12, border: "none", cursor: "pointer", marginBottom: 4, transition: "all 0.2s",
                background: isActive ? colors.lavenderPale : "transparent",
                color: isActive ? colors.sageDark : colors.warmGray,
                justifyContent: sidebarOpen ? "flex-start" : "center",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${colors.lavenderPale}50`; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                <item.icon size={20} />
                {sidebarOpen && <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          position: 'absolute', right: -14, top: 32, width: 28, height: 28, borderRadius: '50%',
          background: colors.white, border: `1px solid ${colors.lavenderPale}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {sidebarOpen ? <X size={14} color={colors.warmGray} /> : <Menu size={14} color={colors.warmGray} />}
        </button>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          background: colors.white, borderBottom: `1px solid ${colors.lavenderPale}`,
          padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.cream, borderRadius: 12, padding: '10px 16px', flex: 1 }}>
              <Search size={16} color={colors.warmGray} />
              <span style={{ color: colors.warmGray, fontSize: 14 }}>Buscar produtos, vendas...</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} color={colors.warmGray} />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: colors.danger }} />
            </div>
            <div style={{ width: 1, height: 24, background: colors.lavenderPale }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.lavender}, ${colors.rose})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: colors.white, fontWeight: 600, fontSize: 14 }}>LA</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.charcoal }}>Lumine</div>
                <div style={{ fontSize: 11, color: colors.warmGray }}>Proprietária</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
          {activePage === "dashboard" && (
            <>
              {/* Welcome */}
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 4 }}>
                  Bom dia, Lumine ✨
                </h1>
                <p style={{ color: colors.warmGray, fontSize: 14 }}>Aqui está o resumo de hoje — 06 de Abril, 2026</p>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 20, marginBottom: 32, flexWrap: "wrap" }}>
                <StatCard icon={DollarSign} label="Vendas Hoje" value="R$ 1.247" change="+23%" changeType="up" color={`${colors.success}20`} />
                <StatCard icon={ShoppingBag} label="Pedidos Hoje" value="8" change="+2" changeType="up" color={`${colors.lavender}30`} />
                <StatCard icon={Package} label="Itens em Estoque" value="1.432" change="-12" changeType="down" color={`${colors.gold}30`} />
                <StatCard icon={AlertTriangle} label="Estoque Baixo" value="4" color={`${colors.danger}20`} />
              </div>

              {/* Charts Row */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 32 }}>
                {/* Revenue Chart */}
                <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal }}>Faturamento — Março 2026</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['7D', '30D', '90D'].map((p, i) => (
                        <button key={p} style={{ padding: '6px 14px', borderRadius: 8, border: i === 1 ? 'none' : `1px solid ${colors.lavenderPale}`, background: i === 1 ? colors.lavender : 'transparent', color: i === 1 ? colors.white : colors.warmGray, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.lavenderPale} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: colors.warmGray }} />
                      <YAxis tick={{ fontSize: 12, fill: colors.warmGray }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`R$ ${value.toLocaleString()}`, 'Faturamento']} />
                      <Line type="monotone" dataKey="value" stroke={colors.lavender} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Low Stock */}
                <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal }}>Estoque Baixo</h3>
                    <AlertTriangle size={16} color={colors.danger} />
                  </div>
                  {lowStockItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < lowStockItems.length - 1 ? `1px solid ${colors.lavenderPale}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: colors.charcoal }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: colors.warmGray }}>Mín: {item.min} un.</div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: item.status === 'critical' ? `${colors.danger}15` : `${colors.gold}15`,
                        color: item.status === 'critical' ? colors.danger : colors.gold,
                      }}>
                        {item.stock} un.
                      </span>
                    </div>
                  ))}
                  <button style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${colors.lavenderPale}`, background: 'transparent', color: colors.sage, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    Ver todos <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Bottom Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Recent Sales */}
                <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal }}>Últimas Vendas</h3>
                    <button style={{ background: 'none', border: 'none', color: colors.lavender, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Ver todas <ChevronRight size={14} />
                    </button>
                  </div>
                  {recentSales.map((sale, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < recentSales.length - 1 ? `1px solid ${colors.lavenderPale}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.lavenderPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ShoppingCart size={16} color={colors.sage} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: colors.charcoal }}>Venda {sale.id}</div>
                          <div style={{ fontSize: 11, color: colors.warmGray }}>{sale.time} · {sale.items} itens · {sale.method}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.charcoal }}>{sale.total}</div>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div style={{ background: colors.white, borderRadius: 16, padding: 24, border: `1px solid ${colors.lavenderPale}` }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.charcoal, marginBottom: 20 }}>Ações Rápidas</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { icon: ShoppingCart, label: 'Nova Venda', color: colors.lavender },
                      { icon: Plus, label: 'Novo Produto', color: colors.success },
                      { icon: FileSpreadsheet, label: 'Importar Planilha', color: colors.gold },
                      { icon: Truck, label: 'Novo Pedido', color: colors.rose },
                    ].map((action, i) => (
                      <button key={i} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 20,
                        borderRadius: 14, border: `1px solid ${colors.lavenderPale}`, background: 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${action.color}10`; e.currentTarget.style.borderColor = action.color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = colors.lavenderPale; }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <action.icon size={20} color={action.color} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: colors.charcoal }}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === "products" && <PageProducts />}
          {activePage === "upload" && <PageUpload />}
          {activePage === "analytics" && <PageAnalytics />}
          {activePage === "insights" && <PageInsights />}

          {activePage === "sales" && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <ShoppingCart size={48} color={colors.lavenderLight} style={{ marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 8 }}>Vendas & PDV</h2>
              <p style={{ color: colors.warmGray, fontSize: 14 }}>Módulo de ponto de venda com carrinho, busca de produtos e múltiplos métodos de pagamento</p>
            </div>
          )}
          {activePage === "orders" && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Truck size={48} color={colors.lavenderLight} style={{ marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 8 }}>Pedidos de Reposição</h2>
              <p style={{ color: colors.warmGray, fontSize: 14 }}>Gerencie pedidos para fornecedores com tracking de status automático</p>
            </div>
          )}
          {activePage === "settings" && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Settings size={48} color={colors.lavenderLight} style={{ marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.charcoal, fontFamily: "'Cormorant Garamond', Georgia, serif", marginBottom: 8 }}>Configurações</h2>
              <p style={{ color: colors.warmGray, fontSize: 14 }}>Perfil da loja, gerenciar usuários, categorias e backups</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
