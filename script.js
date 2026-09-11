// ========== 医路心愿墙 · script.js ==========
(function () {
  "use strict";

  const STORAGE_KEY = "medical-wish-wall:v1";
  const SEED_KEY = "medical-wish-wall:seeded";

  // 初始示例心愿（首次访问注入）
  const SEED_WISHES = [
    { id: 1, name: "19级临床·学姐", cat: "考研上岸", text: "愿所有熬夜背书的夜晚，都变成录取通知书的重量。西综冲冲冲！", likes: 23, time: "2026-09-01 08:00", liked: false },
    { id: 2, name: "匿名小大夫", cat: "考试通关", text: "生理生化必有一劫，病理药理九死一生——但这次我想全过了！求过求过🙏", likes: 17, time: "2026-09-02 12:30", liked: false },
    { id: 3, name: "解剖课代表", cat: "考试通关", text: "希望系解期中考的每一条神经，都是我背过的那一根。大体老师，谢谢您。", likes: 12, time: "2026-09-03 09:15", liked: false },
    { id: 4, name: "规培第三年", cat: "规培实习", text: "愿轮转的每个科室都有温柔的带教，愿我的第一份病历一次通过！", likes: 9, time: "2026-09-04 20:40", liked: false },
    { id: 5, name: "科研小白鼠", cat: "科研论文", text: "细胞啊细胞，求你别再死了；SPSS啊SPSS，求你p<0.05。第一篇SCI拜托了！", likes: 31, time: "2026-09-05 23:10", liked: false },
    { id: 6, name: "六级钉子户", cat: "英语进阶", text: "文献读不动？先让六级过个520再说。这次阅读必须稳住！", likes: 8, time: "2026-09-06 07:50", liked: false },
    { id: 7, name: "夜班守夜人", cat: "身心健康", text: "愿我们熬的不是夜，是未来的底气。但也请记得好好吃饭、好好睡觉。", likes: 26, time: "2026-09-07 01:20", liked: false }
  ];

  let wishes = [];
  let currentFilter = "all";
  let nextId = 100;

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        wishes = JSON.parse(raw);
      } else if (!localStorage.getItem(SEED_KEY)) {
        wishes = SEED_WISHES.slice();
        localStorage.setItem(SEED_KEY, "1");
        save();
      }
    } catch (e) {
      wishes = SEED_WISHES.slice();
    }
    const maxId = wishes.reduce((m, w) => Math.max(m, w.id || 0), 0);
    nextId = maxId + 1;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wishes)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function fmtNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ---------- 渲染 ----------
  function render() {
    const wall = $("#wall");
    const list = currentFilter === "all" ? wishes : wishes.filter((w) => w.cat === currentFilter);

    // 按点赞数排序，让热门心愿排前面
    list.sort((a, b) => (b.likes || 0) - (a.likes || 0));

    wall.innerHTML = "";
    list.forEach((w, i) => wall.appendChild(buildCard(w, i)));
    $("#empty").hidden = list.length > 0;
    renderStats();
  }

  function buildCard(w, i) {
    const card = document.createElement("article");
    card.className = "wish-card cat-" + w.cat;
    card.style.setProperty("--tilt", ((i * 37) % 5 - 2) + "deg"); // -2 ~ 2 度随机倾斜
    card.style.animationDelay = Math.min(i * 60, 480) + "ms";

    const tag = document.createElement("span");
    tag.className = "wish-tag cat-tag-" + w.cat;
    tag.textContent = w.cat;

    const del = document.createElement("button");
    del.className = "wish-del";
    del.textContent = "✕";
    del.title = "删除这条心愿";
    del.setAttribute("aria-label", "删除这条心愿");
    del.addEventListener("click", () => {
      if (confirm("确定撕掉这张「" + w.cat + "」处方吗？")) {
        wishes = wishes.filter((x) => x.id !== w.id);
        save();
        render();
        showToast("心愿已撕下，但它仍在你心里 ✨");
      }
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
    like.addEventListener("click", () => {
      if (w.liked) {
        w.liked = false;
        w.likes = Math.max(0, (w.likes || 0) - 1);
      } else {
        w.liked = true;
        w.likes = (w.likes || 0) + 1;
        showToast("已为 TA 加油，医路同行 💪");
      }
      save();
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
    // 最热分类
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

  $("#wish-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const text = $("#wish-text").value.trim();
    if (!text) { showToast("处方内容不能为空哦～"); return; }
    const name = $("#wish-name").value.trim() || "匿名医学生";
    const cat = $("#wish-cat").value;

    wishes.unshift({ id: nextId++, name, cat, text, likes: 0, time: fmtNow(), liked: false });
    save();

    // 重置表单 + 切到对应分类视图
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
  load();
  render();
})();
