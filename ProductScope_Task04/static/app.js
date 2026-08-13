
let products = [];
let source = "—";
let startedAt = null;
const $ = (id) => document.getElementById(id);

const demoData = [
  {name:"Aero Wireless Headphones",price:129.99,rating:4.8,currency:"USD",source:"DEMO STORE",url:"#",method:"DEMO"},
  {name:"Orbit Mechanical Keyboard",price:89.50,rating:4.6,currency:"USD",source:"DEMO STORE",url:"#",method:"DEMO"},
  {name:"NOVA Smartwatch",price:199.00,rating:4.7,currency:"USD",source:"DEMO STORE",url:"#",method:"DEMO"},
  {name:"Flux USB-C Hub",price:39.99,rating:4.5,currency:"USD",source:"DEMO STORE",url:"#",method:"DEMO"},
  {name:"PixelView Monitor",price:279.99,rating:4.4,currency:"USD",source:"DEMO STORE",url:"#",method:"DEMO"}
];

function toast(message){
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(()=>el.classList.remove("show"), 2600);
}

function formatPrice(value, currency=""){
  if(value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${currency ? currency + " " : "$"}${Number(value).toFixed(2)}`;
}

function setProcess(percent, activeIndex=0){
  $("processNumber").textContent = `${percent}%`;
  document.querySelectorAll(".pipe").forEach((pipe, index)=>{
    pipe.classList.toggle("active", index <= activeIndex);
    pipe.querySelector("i").textContent = index < activeIndex ? "DONE" : index === activeIndex ? "ACTIVE" : "—";
  });
}

function updateStats(){
  const validPrices = products.filter(p=>Number.isFinite(Number(p.price)));
  const validRatings = products.filter(p=>Number.isFinite(Number(p.rating)));
  const avgPrice = validPrices.length ? validPrices.reduce((a,p)=>a+Number(p.price),0)/validPrices.length : null;
  const avgRating = validRatings.length ? validRatings.reduce((a,p)=>a+Number(p.rating),0)/validRatings.length : null;

  $("recordCount").textContent = String(products.length).padStart(3,"0");
  $("countBadge").textContent = products.length;
  $("avgPrice").textContent = avgPrice === null ? "—" : "$" + avgPrice.toFixed(2);
  $("avgRating").textContent = avgRating === null ? "—" : avgRating.toFixed(2);
  $("sourceName").textContent = source;
  $("exportBtn").disabled = products.length === 0;
}

function render(){
  let view = [...products];
  const query = $("searchInput").value.trim().toLowerCase();
  const order = $("sortSelect").value;

  if(query) view = view.filter(p=>p.name.toLowerCase().includes(query));
  if(order === "priceAsc") view.sort((a,b)=>(Number(a.price)||Infinity)-(Number(b.price)||Infinity));
  if(order === "priceDesc") view.sort((a,b)=>(Number(b.price)||-Infinity)-(Number(a.price)||-Infinity));
  if(order === "ratingDesc") view.sort((a,b)=>(Number(b.rating)||-Infinity)-(Number(a.rating)||-Infinity));

  $("tableBody").innerHTML = view.length ? view.map((p,i)=>`
    <tr>
      <td>${String(i+1).padStart(2,"0")}</td>
      <td>${escapeHTML(p.name)}</td>
      <td>${formatPrice(p.price,p.currency)}</td>
      <td>${p.rating == null ? "—" : "★ " + Number(p.rating).toFixed(1)}</td>
      <td>${escapeHTML(p.method || "HTML")}</td>
      <td>${p.url && p.url !== "#" ? `<a href="${p.url}" target="_blank" rel="noopener">VIEW ↗</a>` : "—"}</td>
    </tr>`).join("") :
    `<tr class="empty-row"><td colspan="6"><div class="empty-mark">✦</div><b>No matching records.</b><span>Change your filter or run another collection.</span></td></tr>`;
}

function escapeHTML(text){
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function runScan(){
  const url = $("urlInput").value.trim();
  if(!url) return toast("Paste a public product or category URL first.");
  try { new URL(url); } catch { return toast("Please enter a valid URL."); }

  startedAt = Date.now();
  $("scanBtn").disabled = true;
  $("scanBtn").innerHTML = "WORKING...";
  $("engineState").textContent = "FETCHING";
  $("signalText").textContent = "COLLECTING PRODUCT DATA";
  setProcess(20,0);

  const stages = [[35,1],[58,2],[78,2]];
  let stageIndex = 0;
  const animation = setInterval(()=>{
    if(stageIndex < stages.length) setProcess(...stages[stageIndex++]);
  }, 420);

  try{
    const response = await fetch("/api/scrape",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url})
    });
    const result = await response.json();
    if(!response.ok) throw new Error(result.detail || "Collection failed.");

    clearInterval(animation);
    products = result.products;
    source = result.source || "—";
    setProcess(100,3);
    $("engineState").textContent = "COMPLETE";
    $("signalText").textContent = "DATASET GENERATED";
    updateStats();
    render();
    toast(`${result.count} product records collected successfully.`);
    document.getElementById("records").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    clearInterval(animation);
    setProcess(0,0);
    $("engineState").textContent = "ERROR";
    $("signalText").textContent = "ENGINE NEEDS A DIFFERENT PAGE";
    toast(error.message);
  }finally{
    $("scanBtn").disabled = false;
    $("scanBtn").innerHTML = 'ANALYZE <b>→</b>';
  }
}

$("scanBtn").addEventListener("click",runScan);
$("urlInput").addEventListener("keydown",(e)=>{if(e.key==="Enter")runScan()});
$("searchInput").addEventListener("input",render);
$("sortSelect").addEventListener("change",render);
$("exportBtn").addEventListener("click",()=>{window.location.href="/api/export";});

$("themeBtn").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("productscope-theme",document.body.classList.contains("dark")?"dark":"light");
});
if(localStorage.getItem("productscope-theme")==="dark") document.body.classList.add("dark");

document.querySelectorAll(".nav").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));
  button.classList.add("active");
  const target=document.getElementById(button.dataset.target);
  if(target) target.scrollIntoView({behavior:"smooth"});
}));

document.addEventListener("mousemove",(e)=>{
  const glow=document.querySelector(".cursor-glow");
  glow.style.left=e.clientX+"px";glow.style.top=e.clientY+"px";
});

setInterval(()=>{
  if(startedAt) $("timer").textContent = new Date(Date.now()-startedAt).toISOString().slice(14,19);
},1000);

setProcess(0,0);
