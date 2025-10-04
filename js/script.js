// --- Sessão / Login ---
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
if (!currentUser) window.location.href = "index.html";
document.getElementById("user-info").textContent = `${currentUser.user} (${currentUser.role})`;
document.getElementById("btn-logout").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

// --- Navegação ---
function show(sec) {
  document.querySelectorAll("main section").forEach(s => s.style.display = "none");
  document.getElementById("section-" + sec).style.display = "block";
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  document.getElementById("nav-" + sec).classList.add("active");
}
["products", "pos", "customers", "reports", "finance"].forEach(sec => {
  document.getElementById("nav-" + sec).onclick = () => show(sec);
});

// Restrições de menu
if (currentUser.role === "Caixa") {
  ["nav-products", "nav-finance"].forEach(id => document.getElementById(id).style.display = "none");
  show("pos");
} else show("products");

// --- Storage e helpers ---
const STORE = { P: "loja_products", C: "loja_customers", S: "loja_sales" };
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const money = v => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

// Estado
let state = {
  products: load(STORE.P, []),
  customers: load(STORE.C, []),
  sales: load(STORE.S, []),
  cart: []
};

// ================= PRODUTOS =================
document.getElementById("btn-new-product").onclick = addProduct;

function renderProducts() {
  const tbody = document.querySelector("#product-table tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser.role === "Admin";

  state.products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td>${money(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        ${isAdmin ? `<button onclick="editProduct('${p.id}')">Editar</button> <button onclick="delProduct('${p.id}')">Excluir</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
    if (isAdmin) {
      tr.querySelector(".btn-edit-product").onclick = () => editProduct(p.id);
      tr.querySelector(".btn-del-product").onclick = () => delProduct(p.id);
    }
  });
  save(STORE.P, state.products);
}

function addProduct() {
  const name = prompt("Nome do produto");
  if (!name) return;
  const sku = prompt("SKU");
  if (!sku) return;
  const price = parseFloat(prompt("Preço"));
  if (isNaN(price)) return alert("Preço inválido");
  const stock = parseInt(prompt("Estoque"));
  if (isNaN(stock)) return alert("Estoque inválido");

  state.products.push({ id: Date.now() + "", name, sku, price, stock });
  renderProducts();
}

function delProduct(id) {
  if (currentUser.role !== "Admin") return alert("Apenas admin pode excluir produtos.");
  state.products = state.products.filter(p => p.id !== id);
  renderProducts();
}

function editProduct(id) {
  if (currentUser.role !== "Admin") return alert("Apenas admin pode editar produtos.");
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  const newName = prompt("Novo nome:", p.name);
  if (newName === null) return;
  const newSku = prompt("Novo SKU:", p.sku);
  if (newSku === null) return;
  const newPrice = parseFloat(prompt("Novo preço:", p.price));
  if (isNaN(newPrice)) return alert("Preço inválido");
  const newStock = parseInt(prompt("Novo estoque:", p.stock));
  if (isNaN(newStock)) return alert("Estoque inválido");

  p.name = newName; p.sku = newSku; p.price = newPrice; p.stock = newStock;
  renderProducts();
}

// ================= PDV =================
function renderCart() {
  const tbody = document.querySelector("#cart-table tbody");
  tbody.innerHTML = "";
  let total = 0;
  state.cart.forEach((it, i) => {
    const p = state.products.find(x => x.id === it.id);
    if (!p) return;
    const line = p.price * it.qty; total += line;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${money(p.price)}</td>
      <td>${it.qty}</td>
      <td>${money(line)}</td>
      <td><button onclick="removeCart(${i})">X</button></td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("pos-total").textContent = money(total);
}

function removeCart(i) { state.cart.splice(i, 1); renderCart(); }

function addToCart(query, qty) {
  const q = query.toLowerCase();
  const p = state.products.find(x => x.name.toLowerCase().includes(q) || x.sku.toLowerCase() === q);
  if (!p) { alert("Produto não encontrado"); return; }
  if (p.stock < qty) { alert("Estoque insuficiente"); return; }
  const existing = state.cart.find(it => it.id === p.id);
  if (existing) existing.qty += qty; else state.cart.push({ id: p.id, qty });
  renderCart();
}

// autocomplete
const searchInput = document.getElementById("pos-search");
const qtyInput = document.getElementById("pos-qty");
const suggestionBox = document.createElement("div");
suggestionBox.id = "suggestions";
suggestionBox.style.position = "absolute";
suggestionBox.style.background = "#fff";
suggestionBox.style.border = "1px solid #ccc";
suggestionBox.style.zIndex = "1000";
suggestionBox.style.display = "none";
searchInput.parentNode.appendChild(suggestionBox);

searchInput.addEventListener("input", e => {
  const value = e.target.value.toLowerCase();
  suggestionBox.innerHTML = "";
  if (!value) { suggestionBox.style.display = "none"; return; }
  const matches = state.products.filter(p => p.name.toLowerCase().includes(value) || p.sku.toLowerCase().includes(value));
  if (!matches.length) { suggestionBox.style.display = "none"; return; }
  matches.slice(0,5).forEach(p => {
    const div = document.createElement("div");
    div.style.padding = "4px"; div.style.cursor = "pointer";
    div.textContent = `${p.name} (${p.sku})`;
    div.onclick = () => { searchInput.value = p.name; suggestionBox.style.display = "none"; };
    suggestionBox.appendChild(div);
  });
  suggestionBox.style.display = "block";
  suggestionBox.style.width = searchInput.offsetWidth + "px";
  suggestionBox.style.top = (searchInput.offsetTop + searchInput.offsetHeight) + "px";
  suggestionBox.style.left = searchInput.offsetLeft + "px";
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const qty = Math.max(1, parseInt(qtyInput.value || "1"));
    addToCart(searchInput.value, qty);
    searchInput.value = ""; qtyInput.value = 1;
    suggestionBox.style.display = "none";
  }
});

document.getElementById("btn-add-to-cart").onclick = () => {
  const qty = Math.max(1, parseInt(qtyInput.value || "1"));
  addToCart(searchInput.value, qty);
  searchInput.value = ""; qtyInput.value = 1;
  suggestionBox.style.display = "none";
};

document.getElementById("btn-complete-sale").onclick = () => {
  if (!state.cart.length) return alert("Carrinho vazio");
  const customerId = document.getElementById("pos-customer").value || null;
  const total = parseFloat(document.getElementById("pos-total").textContent.replace("R$","").replace(",",".")) || 0;
  const payment = document.getElementById("pos-payment").value;

  state.sales.push({ id: Date.now()+"", date: new Date().toISOString(), items:[...state.cart], total, payment, customerId });
  state.cart.forEach(it => { const p = state.products.find(x => x.id===it.id); if(p) p.stock -= it.qty; });
  state.cart = [];
  renderCart(); renderProducts(); renderReports(); renderFinance();
  save(STORE.P, state.products); save(STORE.S, state.sales);
  alert("Venda registrada com sucesso!");
};

// ================= CLIENTES =================
function normalizeCpf(cpf){ return (cpf||'').toString().replace(/\D/g,''); }
function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderCustomers() {
  const wrap = document.getElementById("customers-wrap"); if(!wrap) return;
  wrap.innerHTML = "";
  const isAdmin = currentUser.role==="Admin";
  state.customers.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div><strong>${escapeHtml(c.name)}</strong> - CPF: ${escapeHtml(c.cpf)} ${c.phone ? '| Telefone: ' + escapeHtml(c.phone) : ''}</div>
      <div style="margin-top:6px">
        <button class="btn-history">Histórico</button>
        ${isAdmin ? `<button class="btn-edit-customer">Editar</button> <button class="btn-del-customer">Excluir</button>` : ''}
      </div>
    `;
    wrap.appendChild(div);
    div.querySelector(".btn-history").onclick = () => showHistory(c.id);
    if (isAdmin) {
      div.querySelector(".btn-edit-customer").onclick = () => editCustomer(c.id);
      div.querySelector(".btn-del-customer").onclick = () => delCustomer(c.id);
    }
  });
  save(STORE.C, state.customers);
  renderCustomerSelect();
}

function addCustomer() {
  let name = prompt("Nome do cliente");
  if(!name) return;
  let cpf = prompt("CPF (somente números)"); if(!cpf) return;
  let phone = prompt("Telefone (opcional)") || '';

  const cpfNorm = normalizeCpf(cpf);
  if(state.customers.some(c => normalizeCpf(c.cpf)===cpfNorm)) return alert("Cliente já existe!");
  const id = Date.now()+"";
  state.customers.push({id,name,cpf,phone});
  save(STORE.C,state.customers); renderCustomers();
}

function editCustomer(id){
  if(currentUser.role!=="Admin") return alert("Apenas admin pode editar clientes");
  const c = state.customers.find(x=>x.id===id); if(!c) return alert("Cliente não encontrado");
  const newName = prompt("Novo nome:",c.name); if(newName===null) return;
  const newCpf = prompt("Novo CPF:",c.cpf); if(newCpf===null) return;
  const newCpfNorm = normalizeCpf(newCpf);
  if(newCpfNorm!==normalizeCpf(c.cpf) && state.customers.some(x=>normalizeCpf(x.cpf)===newCpfNorm)) return alert("Já existe um cliente com esse CPF!");
  const newPhone = prompt("Novo telefone:",c.phone||""); if(newPhone===null) return;
  c.name=newName; c.cpf=newCpf; c.phone=newPhone;
  save(STORE.C,state.customers); renderCustomers();
}

function delCustomer(id){
  if(currentUser.role!=="Admin") return alert("Apenas admin pode excluir clientes.");
  if(!confirm("Confirma exclusão deste cliente?")) return;
  state.customers = state.customers.filter(c=>c.id!==id);
  save(STORE.C,state.customers); renderCustomers();
}

function renderCustomerSelect(){
  const select = document.getElementById("pos-customer"); if(!select) return;
  select.innerHTML='<option value="">-- Selecione um cliente --</option>';
  state.customers.forEach(c=>{
    const opt = document.createElement("option"); opt.value=c.id; opt.textContent=`${c.name} (${c.cpf})`;
    select.appendChild(opt);
  });
}

function showHistory(id){
  const cust = state.customers.find(c=>c.id===id);
  if(!cust) return alert("Cliente não encontrado");
  const sales = state.sales.filter(s=>s.customerId===id);
  if(!sales.length) return alert("Nenhuma compra encontrada");
  let msg = `Histórico de ${cust.name} (CPF: ${cust.cpf})\n\n`;
  sales.forEach(s=>{
    msg += `Data: ${new Date(s.date).toLocaleString()}\nTotal: ${money(s.total)}\nItens:\n`;
    s.items.forEach(it=>{
      const p = state.products.find(x=>x.id===it.id);
      msg += `- ${p?.name || "Produto"} x${it.qty}\n`;
    });
    msg+="------------------------\n";
  });
  alert(msg);
}

document.getElementById("btn-new-customer").onclick = addCustomer;

// ================= RELATÓRIOS =================
function renderReports(){
  const total = state.sales.reduce((s,x)=>s+x.total,0);
  document.getElementById("report-total").textContent=money(total);
  document.getElementById("report-count").textContent=state.sales.length;
}

// ================= FINANCEIRO =================
function renderFinance(){
  const sum = {Dinheiro:0,Cartao:0,PIX:0};
  state.sales.forEach(s=>sum[s.payment]+=s.total);
  document.getElementById("finance-summary").innerHTML=`
    Dinheiro: ${money(sum.Dinheiro)}<br>
    Cartão: ${money(sum.Cartao)}<br>
    PIX: ${money(sum.PIX)}
  `;
}

// ================= INICIALIZAÇÃO =================
function renderAll(){
  renderProducts(); renderCart(); renderCustomers(); renderReports(); renderFinance();
}
renderAll();

// Expose global
window.delProduct = delProduct;
window.edit
