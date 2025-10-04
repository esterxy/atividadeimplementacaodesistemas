// --- Sessão / Login ---
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
if(!currentUser) window.location.href="index.html";

document.getElementById("user-info").textContent = `${currentUser.user} (${currentUser.role})`;
document.getElementById("btn-logout").onclick = () => {
    localStorage.removeItem("currentUser");
    window.location.href="index.html";
};

// --- Navegação ---
function show(sec){
    document.querySelectorAll("main section").forEach(s=>s.style.display="none");
    document.getElementById("section-"+sec).style.display="block";
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.getElementById("nav-"+sec).classList.add("active");
}
["products","pos","customers","reports","finance"].forEach(sec=>{
    document.getElementById("nav-"+sec).onclick = () => show(sec);
});

// Restrições de menu
if(currentUser.role==="Caixa"){
    ["nav-products","nav-customers","nav-reports","nav-finance"].forEach(id=>document.getElementById(id).style.display="none");
    show("pos");
}else show("products");

// --- Storage e helpers ---
const STORE = {P:"loja_products", C:"loja_customers", S:"loja_sales"};
const load = (k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}};
const save = (k,v)=>localStorage.setItem(k,JSON.stringify(v));
const money = v=>"R$ "+(Number(v)||0).toFixed(2).replace(".",",");

const state = {
    products: load(STORE.P, []),
    customers: load(STORE.C, []),
    sales: load(STORE.S, []),
    cart: []
};

// ================= PRODUTOS =================
document.getElementById("btn-new-product").onclick = addProduct;

function renderProducts(){
    const tbody = document.querySelector("#product-table tbody");
    tbody.innerHTML = "";
    const isAdmin = currentUser.role === "Admin";

    state.products.forEach(p=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.sku}</td>
            <td>${p.name}</td>
            <td>${money(p.price)}</td>
            <td>${p.stock}</td>
            <td>
                ${isAdmin ? `<button class="btn-edit" onclick="editProduct('${p.id}')">Editar</button> <button class="btn-del" onclick="delProduct('${p.id}')">Excluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    save(STORE.P,state.products);
}

function addProduct(){
    const name = prompt("Nome do produto"); if(!name) return;
    const sku = prompt("SKU"); if(!sku) return;
    const price = parseFloat(prompt("Preço")); if(isNaN(price)) return alert("Preço inválido");
    const stock = parseInt(prompt("Estoque")); if(isNaN(stock)) return alert("Estoque inválido");

    state.products.push({id:Date.now()+"", name, sku, price, stock});
    renderProducts();
}

function delProduct(id){
    if(currentUser.role!=="Admin") return alert("Apenas admin pode excluir produtos");
    if(!confirm("Tem certeza que deseja excluir este produto?")) return;
    state.products = state.products.filter(p=>p.id!==id);
    renderProducts();
}

function editProduct(id){
    if(currentUser.role!=="Admin") return alert("Apenas admin pode editar produtos");
    const p = state.products.find(x=>x.id===id); if(!p) return;
    const newName = prompt("Novo nome:",p.name); if(newName===null) return;
    const newSku = prompt("Novo SKU:",p.sku); if(newSku===null) return;
    const newPrice = parseFloat(prompt("Novo preço:",p.price)); if(isNaN(newPrice)) return alert("Preço inválido");
    const newStock = parseInt(prompt("Novo estoque:",p.stock)); if(isNaN(newStock)) return alert("Estoque inválido");

    p.name=newName; p.sku=newSku; p.price=newPrice; p.stock=newStock;
    renderProducts();
}

// ================= PDV =================
document.getElementById("btn-add-to-cart").onclick = () => {
    const query = document.getElementById("pos-search").value;
    const qty = parseInt(document.getElementById("pos-qty").value);
    if(!query || isNaN(qty) || qty < 1) return alert("Verifique o produto e a quantidade.");
    addToCart(query, qty);
    document.getElementById("pos-search").value = "";
    document.getElementById("pos-qty").value = "1";
};

function renderCart(){
    const tbody = document.querySelector("#cart-table tbody");
    tbody.innerHTML="";
    let total=0;
    state.cart.forEach((it,i)=>{
        const p = state.products.find(x=>x.id===it.id); if(!p) return;
        const line = p.price*it.qty; total+=line;
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
    document.getElementById("pos-total").textContent=money(total);
}

function removeCart(i){state.cart.splice(i,1); renderCart();}

function addToCart(query,qty){
    const q=query.toLowerCase();
    const p=state.products.find(x=>x.name.toLowerCase().includes(q) || x.sku.toLowerCase()===q);
    if(!p){alert("Produto não encontrado"); return;}
    const inCartQty = state.cart.find(it => it.id === p.id)?.qty || 0;
    if(p.stock < (qty + inCartQty)){alert("Estoque insuficiente"); return;}
    const existing = state.cart.find(it=>it.id===p.id);
    if(existing) existing.qty+=qty; else state.cart.push({id:p.id, qty});
    renderCart();
}

function applyDiscount(total, discountPercent){
    const discount = total * (discountPercent / 100);
    return total - discount;
}

document.getElementById("btn-complete-sale").onclick = () => {
    if(!state.cart.length) return alert("Carrinho vazio");
    const customerId = document.getElementById("pos-customer").value||null;
    const total = state.cart.reduce((acc, it) => acc + (state.products.find(p => p.id === it.id)?.price || 0) * it.qty, 0);
    const payment = document.getElementById("pos-payment").value;
    const discount = 0; // Você pode adicionar um campo de desconto no HTML se quiser

    const finalTotal = applyDiscount(total, discount);

    state.sales.push({id:Date.now()+"", date:new Date().toISOString(), items:[...state.cart], total:finalTotal, payment, customerId});
    state.cart.forEach(it=>{const p=state.products.find(x=>x.id===it.id); if(p)p.stock-=it.qty;});
    state.cart=[];
    renderCart(); renderProducts(); renderReports(); renderFinance();
    save(STORE.P,state.products); save(STORE.S,state.sales);
    alert(`Venda registrada com sucesso! Total: ${money(finalTotal)}`);
};

// ================= CLIENTES =================
function normalizeCpf(cpf){return (cpf||'').toString().replace(/\D/g,'');}
function escapeHtml(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderCustomerSelect() {
    const select = document.getElementById("pos-customer");
    select.innerHTML = '<option value="">Cliente Avulso</option>';
    state.customers.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        select.appendChild(option);
    });
}

function renderCustomers() {
  const wrap = document.getElementById("customers-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const isAdmin = currentUser.role === "Admin";

  state.customers.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
        <div><strong>${escapeHtml(c.name)}</strong> - CPF: ${escapeHtml(c.cpf)}${c.phone ? '| Telefone: ' + escapeHtml(c.phone) : ''}</div>
        <div style="margin-top: 6px;">
            <button class="btn ghost" onclick="showHistory('${c.id}')">Histórico</button>
            ${isAdmin ? `
                <button class="btn ghost" onclick="editCustomer('${c.id}')">Editar</button>
                <button class="btn ghost" onclick="delCustomer('${c.id}')">Excluir</button>
            ` : ''}
        </div>
    `;
    wrap.appendChild(div);
  });
  save(STORE.C, state.customers);
  renderCustomerSelect();
}

function addCustomer(){
    let name = prompt("Nome do cliente"); if(!name) return;
    let cpf = prompt("CPF (somente números)"); if(!cpf) return;
    let phone = prompt("Telefone (opcional)")||'';
    const cpfNorm = normalizeCpf(cpf);
    if(state.customers.some(c=>normalizeCpf(c.cpf)===cpfNorm)) return alert("Cliente com este CPF já existe!");
    const id = Date.now()+"";
    state.customers.push({id,name,cpf,phone});
    save(STORE.C,state.customers);
    renderCustomers();
}
document.getElementById("btn-new-customer").onclick = addCustomer;

// --- NOVO CÓDIGO ADICIONADO AQUI ---
function delCustomer(id) {
    if (currentUser.role !== "Admin") return alert("Apenas administradores podem excluir clientes.");
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) return;
    
    state.customers = state.customers.filter(c => c.id !== id);
    renderCustomers();
}

function editCustomer(id) {
    if (currentUser.role !== "Admin") return alert("Apenas administradores podem editar clientes.");
    const customer = state.customers.find(c => c.id === id);
    if (!customer) return alert("Cliente não encontrado.");

    const newName = prompt("Novo nome:", customer.name);
    if (newName === null) return; // Usuário cancelou
    const newCpf = prompt("Novo CPF:", customer.cpf);
    if (newCpf === null) return;
    const newPhone = prompt("Novo Telefone:", customer.phone);
    if (newPhone === null) return;

    customer.name = newName || customer.name;
    customer.cpf = newCpf || customer.cpf;
    customer.phone = newPhone || customer.phone;

    renderCustomers();
}

function showHistory(id) {
    const customer = state.customers.find(c => c.id === id);
    if (!customer) return alert("Cliente não encontrado.");

    const customerSales = state.sales.filter(s => s.customerId === id);
    if (customerSales.length === 0) {
        return alert(`Nenhum histórico de compras para ${customer.name}.`);
    }

    let historyText = `Histórico de Compras de ${customer.name}:\n\n`;
    customerSales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString('pt-BR');
        historyText += `Data: ${date} - Total: ${money(sale.total)}\n`;
        sale.items.forEach(item => {
            const product = state.products.find(p => p.id === item.id);
            historyText += `  - ${item.qty}x ${product ? product.name : 'Produto Removido'}\n`;
        });
        historyText += '------------------------\n';
    });

    alert(historyText);
}
// --- FIM DO NOVO CÓDIGO ---


// ================= RELATÓRIOS =================
function renderReports(){
    const tbody = document.querySelector("#section-reports table tbody");
    if (!tbody) return; // Adicionado para segurança
    tbody.innerHTML = "";
    state.sales.forEach(s => {
        const customer = state.customers.find(c => c.id === s.customerId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${new Date(s.date).toLocaleString('pt-BR')}</td>
            <td>${s.items.reduce((sum, i) => sum + i.qty, 0)}</td>
            <td>${customer ? customer.name : 'Cliente Avulso'}</td>
            <td>${money(s.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    const total = state.sales.reduce((s,x)=>s+x.total,0);
    document.getElementById("report-total").textContent=money(total);
    document.getElementById("report-count").textContent=state.sales.length;
}

// ================= FINANCEIRO =================
function renderFinance(){
    const sum={"Dinheiro":0, "Cartao":0, "PIX":0};
    state.sales.forEach(s=>sum[s.payment] = (sum[s.payment] || 0) + s.total);
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
window.removeCart = removeCart;
window.delProduct = delProduct;
window.editProduct = editProduct;
// --- LINHAS ADICIONADAS PARA GLOBALIZAR AS NOVAS FUNÇÕES ---
window.delCustomer = delCustomer;
window.editCustomer = editCustomer;
window.showHistory = showHistory;