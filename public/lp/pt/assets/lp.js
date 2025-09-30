(function initUTM() {
  try {
    var url = new URL(window.location.href);
    var params = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","a","s"];
    var found = {};
    params.forEach(function(k){ var v = url.searchParams.get(k); if(v) found[k]=v; });
    if (Object.keys(found).length) {
      localStorage.setItem("utm_aff", JSON.stringify({ ...found, ts: Date.now() }));
      document.cookie = "affid="+(found["a"]||"")+";path=/;max-age="+(60*60*24*90);
      document.cookie = "subid="+(found["s"]||"")+";path=/;max-age="+(60*60*24*90);
    }
  } catch(e) {}
})();

function startCheckout(product_slug){
  var utm = {};
  try {
    utm = JSON.parse(localStorage.getItem("utm_aff")||"{}");
  } catch(e) {}

  var body = {
    product_slug: product_slug,
    affid: utm.a || null,
    subid: utm.s || null,
    utm: utm,
    lp_path: window.location.pathname
  };

  fetch("https://api.canvaspiritual.com/v1/checkout/sessions", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(j => {
    if (j && j.url) return window.location.href = j.url;
    alert("Não foi possível iniciar o checkout agora. Tente novamente.");
  })
  .catch(() => alert("Falha de rede. Tente novamente."));
}
