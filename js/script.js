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
    ["nav-products","nav-finance"].forEach(id=>document.getElementById(id).style.display="none");
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
                ${isAdmin ? `<button class="btn-edit">Editar</button> <button class="btn-del">Excluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);

        if(isAdmin){
            tr.querySelector(".btn-edit").onclick = () => editProduct(p.id);
            tr.querySelector(".btn-del").onclick = () => delProduct(p.id);
        }
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
    if(p.stock<qty){alert("Estoque insuficiente"); return;}
    const existing = state.cart.find(it=>it.id===p.id);
    if(existing) existing.qty+=qty; else state.cart.push({id:p.id, qty});
    renderCart();
}

// Desconto PDV
function applyDiscount(discountPercent){
    const total = state.cart.reduce((acc,it)=>{
        const p=state.products.find(x=>x.id===it.id);
        return acc + (p.price*it.qty);
    },0);
    const discount = total*(discountPercent/100);
    return total - discount;
}

document.getElementById("btn-complete-sale").onclick = () => {
    if(!state.cart.length) return alert("Carrinho vazio");
    const customerId = document.getElementById("pos-customer").value||null;
    const total = parseFloat(document.getElementById("pos-total").textContent.replace("R$","").replace(",","."));
    const payment = document.getElementById("pos-payment").value;

    // Exemplo: aplicar 10% de desconto se necessário
    const finalTotal = applyDiscount(0); // alterar 0 para % de desconto real se tiver campo

    state.sales.push({id:Date.now()+"", date:new Date().toISOString(), items:[...state.cart], total:finalTotal, payment, customerId});
    state.cart.forEach(it=>{const p=state.products.find(x=>x.id===it.id); if(p)p.stock-=it.qty;});
    state.cart=[];
    renderCart(); renderProducts(); renderReports(); renderFinance();
    save(STORE.P,state.products); save(STORE.S,state.sales);
    alert("Venda registrada com sucesso!");
};

// ================= CLIENTES =================
function normalizeCpf(cpf){return (cpf||'').toString().replace(/\D/g,'');}
function escapeHtml(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderCustomers() {
  const wrap = document.getElementById("customers-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  const isAdmin = currentUser.role === "Admin";

  state.customers.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";

    // Informações do cliente
    const info = document.createElement("div");
    info.innerHTML = `<strong>${escapeHtml(c.name)}</strong> - CPF: ${escapeHtml(c.cpf)}${c.phone ? '| Telefone: ' + escapeHtml(c.phone) : ''}`;
    div.appendChild(info);

    // Botões
    const actions = document.createElement("div");
    actions.style.marginTop = "6px";

    // Histórico (funciona para todos)
    const btnHistory = document.createElement("button");
    btnHistory.className = "btn-history";
    btnHistory.textContent = "Histórico";
    btnHistory.onclick = () => showHistory(c.id);
    actions.appendChild(btnHistory);

    if (isAdmin) {
      // Editar
      const btnEdit = document.createElement("button");
      btnEdit.className = "btn-edit-customer";
      btnEdit.textContent = "Editar";
      btnEdit.onclick = () => editCustomer(c.id);
      actions.appendChild(btnEdit);

      // Excluir
      const btnDel = document.createElement("button");
      btnDel.className = "btn-del-customer";
      btnDel.textContent = "Excluir";
      btnDel.onclick = () => delCustomer(c.id);
      actions.appendChild(btnDel);
    }

    div.appendChild(actions);
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
    if(state.customers.some(c=>normalizeCpf(c.cpf)===cpfNorm)) return alert("Cliente já existe!");
    const id = Date.now()+"";
    state.customers.push({id,name,cpf,phone});
    save(STORE.C,state.customers);
    renderCustomers();
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
    const sum={Dinheiro:0,Cartao:0,PIX:0};
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
window.editProduct = editProduct;