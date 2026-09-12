// ========== 医路心愿墙 · script.js ==========
// 存储模式：配置 Supabase 后为云端永久保存；未配置则降级为浏览器本地保存
(function () {
  "use strict";

  // ---------- Supabase 配置 ----------
  // 在 https://supabase.com 创建项目后，从「Project Settings → API」复制以下两项
  const SB_URL = "https://nvmlrbxusqqyscmhituf.supabase.co";   // Project URL
  const SB_ANON = "sb_publishable_eessYod4LT6hl-kyV0hbKw_wZRw2tb_";  // publishable/anon key（公开密钥，可安全暴露在前端）
  const SB_TABLE = "wishes";
  const CLOUD_ON = Boolean(SB_URL && SB_ANON);

  const STORAGE_KEY = "medical-wish-wall:v1";
  const SEED_KEY = "medical-wish-wall:seeded";

  // 初始示范心愿（首次访问注入；云端模式下由建表 SQL 或空表检测写入）
  const SEED_WISHES = [
    { name: "19级临床·学姐", cat: "考研上岸", text: "愿所有熬夜背书的夜晚，都变成录取通知书的重量。西综冲冲冲！", likes: 23 },
    { name: "匿名小大夫", cat: "考试通关", text: "生理生化必有一劫，病理药理九死一生——但这次我想全过了！求过求过🙏", likes: 17 },
    { name: "解剖课代表", cat: "考试通关", text: "希望系解期中考的每一条神经，都是我背过的那一根。大体老师，谢谢您。", likes: 12 },
    { name: "规培第三年", cat: "规培实习", text: "愿轮转的每个科室都有温柔的带教，愿我的第一份病历一次通过！", likes: 9 },
    { name: "科研小白鼠", cat: "科研论文", text: "细胞啊细胞，求你别再死了；SPSS啊SPSS，求你p<0.05。第一篇SCI拜托了！", likes: 31 },
    { name: "六级钉子户", cat: "英语进阶", text: "文献读不动？先让六级过个520再说。这次阅读必须稳住！", likes: 8 },
    { name: "夜班守夜人", cat: "身心健康", text: "愿我们熬的不是夜，是未来的底气。但也请记得好好吃饭、好好睡觉。", likes: 26 }
  ];

  let wishes = [];
  let currentFilter = "all";
  let localNextId = 100;

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);

  function fmtNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fmtTime(iso) {
    // 云端 created_at（ISO）→ 本地显示格式
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function cacheLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wishes)); } catch (e) { /* 忽略 */ }
  }

  // ---------- Supabase REST (PostgREST) ----------
  async function sb(method, path, body, prefer) {
    const headers = {
      apikey: SB_ANON,
      Authorization: "Bearer " + SB_ANON,
      "Content-Type": "application/json"
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(SB_URL + "/rest/v1/" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error("Supabase " + method + " " + path + " -> HTTP " + res.status + " " + detail);
    }
    return res.json();
  }

  function rowToWish(r) {
    return {
      id: r.id,
      name: r.name,
      cat: r.cat,
      text: r.text,
      likes: r.likes || 0,
      time: fmtTime(r.created_at),
      liked: false
    };
  }

  async function cloudLoad() {
    const rows = await sb("GET", `${SB_TABLE}?select=id,name,cat,text,likes,created_at&order=id.desc&limit=1000`);
    return rows.map(rowToWish);
  }

  async function cloudCreate(w) {
    // CSV 导入建的表 id 不自增，主键由前端按最大 id+1 分配
    const rows = await sb("POST", SB_TABLE,
      { id: w.id, name: w.name, cat: w.cat, text: w.text, likes: w.likes },
      "return=representation");
    return rowToWish(rows[0]);
  }

  async function cloudUpdateLikes(id, likes) {
    await sb("PATCH", `${SB_TABLE}?id=eq.${id}`, { likes });
  }

  async function cloudDelete(id) {
    await sb("DELETE", `${SB_TABLE}?id=eq.${id}`);
  }

  // ---------- 初始化加载 ----------
  async function init() {
    if (CLOUD_ON) {
      try {
        wishes = await cloudLoad();
        if (wishes.length === 0) {
          // 云端为空：写入示范心愿
          let sid = 1;
          for (const seed of SEED_WISHES) {
            try { await sb("POST", SB_TABLE, Object.assign({ id: sid++ }, seed)); } catch (e) { /* 单条失败忽略 */ }
          }
          wishes = await cloudLoad();
        }
        cacheLocal();
      } catch (e) {
        console.warn("云端加载失败，降级本地模式:", e);
        wishes = [];
        loadLocal();
        showToast("云端暂时连不上，当前为本地浏览模式");
      }
    } else {
      loadLocal();
    }
    render();
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        wishes = JSON.parse(raw);
      } else if (!localStorage.getItem(SEED_KEY)) {
        let id = 1;
        wishes = SEED_WISHES.map((s) => ({ id: id++, ...s, time: "2026-09-01 08:00", liked: false }));
        localStorage.setItem(SEED_KEY, "1");
        cacheLocal();
      }
    } catch (e) {
      wishes = [];
    }
    localNextId = wishes.reduce((m, w) => Math.max(m, w.id || 0), 0) + 1;
  }

  // ---------- 渲染 ----------
  function render() {
    const wall = $("#wall");
    const list = currentFilter === "all" ? wishes : wishes.filter((w) => w.cat === currentFilter);
    list.sort((a, b) => (b.likes || 0) - (a.likes || 0));

    wall.innerHTML = "";
    list.forEach((w, i) => wall.appendChild(buildCard(w, i)));
    $("#empty").hidden = list.length > 0;
    renderStats();
  }

  function buildCard(w, i) {
    const card = document.createElement("article");
    card.className = "wish-card cat-" + w.cat;
    card.style.setProperty("--tilt", ((i * 37) % 5 - 2) + "deg");
    card.style.animationDelay = Math.min(i * 60, 480) + "ms";

    const tag = document.createElement("span");
    tag.className = "wish-tag cat-tag-" + w.cat;
    tag.textContent = w.cat;

    const del = document.createElement("button");
    del.className = "wish-del";
    del.textContent = "✕";
    del.title = "撕掉这条心愿";
    del.setAttribute("aria-label", "删除这条心愿");
    del.addEventListener("click", async () => {
      if (!confirm("确定撕掉这张「" + w.cat + "」处方吗？")) return;
      if (CLOUD_ON) {
        del.disabled = true;
        try {
          await cloudDelete(w.id);
        } catch (e) {
          del.disabled = false;
          showToast("删除失败，请稍后再试");
          return;
        }
      }
      wishes = wishes.filter((x) => x !== w);
      cacheLocal();
      render();
      showToast("心愿已撕下，但它仍在你心里 ✨");
    });

    const top = document.createElement("div");
    top.className = "wish-top";
    top.appendChild(tag);
    top.appendChild(del);

    const text = document.createElement("p");
    text.className = "wish-text";
    text.textContent = w.text;

    const foot = document.createElement("div");
    foot.className = "wish-foot";

    const name = document.createElement("span");
    name.className = "wish-name";
    name.textContent = "—— " + (w.name || "匿名医学生") + " · " + (w.time || "");

    const like = document.createElement("button");
    like.className = "wish-like" + (w.liked ? " liked" : "");
    like.textContent = (w.liked ? "❤️" : "🤍") + " " + (w.likes || 0);
    like.title = "为这条心愿加油";
    like.addEventListener("click", async () => {
      if (w.liked) {
        w.liked = false;
        w.likes = Math.max(0, (w.likes || 0) - 1);
      } else {
        w.liked = true;
        w.likes = (w.likes || 0) + 1;
        showToast("已为 TA 加油，医路同行 💪");
      }
      like.textContent = (w.liked ? "❤️" : "🤍") + " " + (w.likes || 0);
      cacheLocal();
      if (CLOUD_ON) {
        try { await cloudUpdateLikes(w.id, w.likes); } catch (e) { /* 单次失败可接受 */ }
      }
      render();
    });

    foot.appendChild(name);
    foot.appendChild(like);

    card.appendChild(top);
    card.appendChild(text);
    card.appendChild(foot);
    return card;
  }

  function renderStats() {
    const total = wishes.length;
    const likes = wishes.reduce((s, w) => s + (w.likes || 0), 0);
    const count = {};
    wishes.forEach((w) => { count[w.cat] = (count[w.cat] || 0) + 1; });
    let topCat = "—", max = 0;
    for (const [cat, n] of Object.entries(count)) {
      if (n > max) { max = n; topCat = cat; }
    }
    $("#stat-total").textContent = total;
    $("#stat-likes").textContent = likes;
    $("#stat-top").textContent = max > 0 ? topCat : "—";
  }

  // ---------- 表单 ----------
  $("#wish-text").addEventListener("input", function () {
    $("#char-num").textContent = this.value.length;
  });

  $("#wish-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const text = $("#wish-text").value.trim();
    if (!text) { showToast("处方内容不能为空哦～"); return; }
    const name = $("#wish-name").value.trim() || "匿名医学生";
    const cat = $("#wish-cat").value;

    let newWish;
    if (CLOUD_ON) {
      const btn = this.querySelector(".btn-submit");
      btn.disabled = true;
      try {
        const maxId = wishes.reduce((m, w) => Math.max(m, w.id || 0), 0);
        newWish = await cloudCreate({ id: maxId + 1, name, cat, text, likes: 0 });
      } catch (err) {
        btn.disabled = false;
        console.warn(err);
        showToast("发布失败：云端暂时连不上，请稍后再试");
        return;
      }
      btn.disabled = false;
    } else {
      newWish = { id: localNextId++, name, cat, text, likes: 0, time: fmtNow(), liked: false };
    }

    wishes.unshift(newWish);
    cacheLocal();

    this.reset();
    $("#char-num").textContent = "0";
    currentFilter = cat;
    document.querySelectorAll(".filter-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.cat === cat)
    );
    render();
    showToast("处方已开具！记得每日默念三次 🩺");
    $("#wall").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- 筛选 ----------
  $("#filter-bar").addEventListener("click", function (e) {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    currentFilter = btn.dataset.cat;
    document.querySelectorAll(".filter-btn").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    render();
  });

  // ---------- 启动 ----------
  render();   // 先渲染骨架
  init();     // 再按存储模式加载真实数据
})();
