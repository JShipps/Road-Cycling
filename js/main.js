/* Tailwind Road Club — template scripts
   1. Mobile navigation
   2. Elevation profile renderer
   3. Route library filters
   4. Join form (front-end only)
*/
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     1. Mobile navigation
     --------------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
  }

  /* ---------------------------------------------------------------
     2. Elevation profiles
     Markup:
       <svg class="profile"
            data-km="84"                         total distance in km
            data-elev="120,135,180,..."          elevations in metres, evenly spaced
            data-climbs="Hollow Gap@23;Mill Hill@61"   optional markers
            data-height="220"                    optional, px
            data-axis="none"                     optional, hides axes (mini profiles)
            data-draw                            optional, animates on load
            role="img" aria-label="..."></svg>
     --------------------------------------------------------------- */
  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceStep(range, target, steps) {
    for (var i = 0; i < steps.length; i++) {
      if (range / steps[i] <= target) return steps[i];
    }
    return steps[steps.length - 1];
  }

  function renderProfile(svg) {
    var elev = (svg.dataset.elev || "").split(",").map(Number).filter(function (n) { return !isNaN(n); });
    if (elev.length < 2) return;

    var km = parseFloat(svg.dataset.km) || elev.length - 1;
    var mini = svg.dataset.axis === "none";
    var climbs = (svg.dataset.climbs || "").split(";").filter(Boolean).map(function (c) {
      var parts = c.split("@");
      return { name: parts[0].trim(), km: parseFloat(parts[1]) };
    });

    var w = Math.max(svg.parentElement.clientWidth, 200);
    var h = parseFloat(svg.dataset.height) || (mini ? 56 : 220);
    var pad = mini
      ? { t: 4, r: 0, b: 2, l: 0 }
      : { t: climbs.length ? 52 : 12, r: 4, b: 26, l: 44 };

    var min = Math.min.apply(null, elev);
    var max = Math.max.apply(null, elev);
    var eStep = niceStep(max - min, 4, [25, 50, 100, 200, 250, 500, 1000]);
    // Mini profiles share a common vertical scale so flat routes look flat.
    var lo = mini ? min - 40 : Math.floor(min / eStep) * eStep;
    var hi = mini ? Math.max(max, lo + 760) : Math.ceil((max + eStep * 0.25) / eStep) * eStep;
    if (hi === lo) hi = lo + 1;

    var iw = w - pad.l - pad.r;
    var ih = h - pad.t - pad.b;
    var x = function (d) { return pad.l + (d / km) * iw; };
    var y = function (e) { return pad.t + ih - ((e - lo) / (hi - lo)) * ih; };

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    // Grid + axes
    if (!mini) {
      var g = el("g", { "aria-hidden": "true" }, svg);
      for (var e = lo; e <= hi; e += eStep) {
        el("line", { x1: pad.l, x2: w - pad.r, y1: y(e), y2: y(e), "class": "p-grid" }, g);
        var t = el("text", { x: pad.l - 8, y: y(e) + 4, "text-anchor": "end", "class": "p-label" }, g);
        t.textContent = e + (e === hi ? " m" : "");
      }
      var kStep = niceStep(km, w < 500 ? 4 : 9, [1, 2, 5, 10, 20, 25, 50, 100]);
      for (var k = 0; k <= km + 0.01; k += kStep) {
        var kt = el("text", { x: x(k), y: h - 6, "text-anchor": k === 0 ? "start" : "middle", "class": "p-label" }, g);
        kt.textContent = k + (k === 0 ? " km" : "");
      }
    }

    // Smoothed path through the points (midpoint quadratic curves)
    var pts = elev.map(function (v, i) { return [x((i / (elev.length - 1)) * km), y(v)]; });
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2;
      var my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += " Q" + pts[i][0] + "," + pts[i][1] + " " + mx + "," + my;
    }
    var last = pts[pts.length - 1];
    d += " L" + last[0] + "," + last[1];

    var base = pad.t + ih;
    el("path", { d: d + " L" + last[0] + "," + base + " L" + pts[0][0] + "," + base + " Z", "class": "p-area" }, svg);
    var line = el("path", { d: d, "class": "p-line" }, svg);

    // Climb markers
    if (!mini && climbs.length) {
      var cg = el("g", { "class": "p-climbs" }, svg);
      climbs.forEach(function (c) {
        // Snap the marker to the highest sample within ~1 km so labels match the real summit.
        var idx = Math.round((c.km / km) * (elev.length - 1)), best = idx;
        for (var j = Math.max(0, idx - 1); j <= Math.min(elev.length - 1, idx + 1); j++) if (elev[j] > elev[best]) best = j;
        var ce = elev[best], cx = x((best / (elev.length - 1)) * km), cy = y(ce);
        var anchor = cx > w * 0.78 ? "end" : "start";
        var dx = anchor === "end" ? -6 : 6;
        el("line", { x1: cx, x2: cx, y1: 6, y2: cy, "class": "p-climb" }, cg);
        el("circle", { cx: cx, cy: cy, r: 4.5, "class": "p-climb-dot" }, cg);
        var n = el("text", { x: cx + dx, y: 16, "text-anchor": anchor, "class": "p-climb-name" }, cg);
        n.textContent = c.name;
        var a = el("text", { x: cx + dx, y: 32, "text-anchor": anchor, "class": "p-climb-alt" }, cg);
        a.textContent = Math.round(ce) + " m, km " + c.km;
      });
    }

    // One-time draw animation
    if (svg.hasAttribute("data-draw") && !svg.dataset.drawn) {
      var len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      svg.classList.add("is-drawing");
      svg.dataset.drawn = "1";
    } else if (svg.dataset.drawn) {
      line.style.strokeDasharray = "none";
    }
  }

  var profiles = document.querySelectorAll("svg.profile");
  profiles.forEach(renderProfile);

  if ("ResizeObserver" in window) {
    var lastWidths = new WeakMap();
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var wNow = Math.round(entry.contentRect.width);
        if (lastWidths.get(entry.target) === wNow) return;
        lastWidths.set(entry.target, wNow);
        var svg = entry.target.querySelector("svg.profile");
        if (svg && svg.dataset.rendered) renderProfile(svg);
        if (svg) svg.dataset.rendered = "1";
      });
    });
    profiles.forEach(function (svg) { ro.observe(svg.parentElement); });
  }

  /* ---------------------------------------------------------------
     3. Route library filters
     --------------------------------------------------------------- */
  var list = document.querySelector("[data-route-list]");
  if (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll(".route-item"));
    var chips = document.querySelectorAll("[data-terrain-filter]");
    var distSelect = document.getElementById("distance-filter");
    var count = document.querySelector("[data-result-count]");
    var empty = document.querySelector("[data-route-empty]");
    var terrain = "all";

    function apply() {
      var range = (distSelect ? distSelect.value : "all").split("-");
      var shown = 0;
      items.forEach(function (item) {
        var km = parseFloat(item.dataset.km);
        var okT = terrain === "all" || item.dataset.terrain === terrain;
        var okD = range[0] === "all" || (km >= parseFloat(range[0]) && km < parseFloat(range[1]));
        var show = okT && okD;
        item.hidden = !show;
        if (show) shown++;
      });
      if (count) count.textContent = shown + (shown === 1 ? " route" : " routes");
      if (empty) empty.hidden = shown !== 0;
      items.forEach(function (item) {
        if (!item.hidden) { var s = item.querySelector("svg.profile"); if (s) renderProfile(s); }
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        terrain = chip.dataset.terrainFilter;
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        apply();
      });
    });
    if (distSelect) distSelect.addEventListener("change", apply);
    apply();
  }

  /* ---------------------------------------------------------------
     4. Join form — front-end validation only.
     Point the form's action at your form service (see README).
     --------------------------------------------------------------- */
  var form = document.querySelector("[data-join-form]");
  if (form) {
    form.addEventListener("submit", function (ev) {
      var valid = true;
      form.querySelectorAll(".error").forEach(function (n) { n.remove(); });
      form.querySelectorAll("[required]").forEach(function (input) {
        input.removeAttribute("aria-invalid");
        if (!input.checkValidity()) {
          valid = false;
          input.setAttribute("aria-invalid", "true");
          var msg = document.createElement("p");
          msg.className = "error";
          msg.id = input.id + "-error";
          msg.textContent = input.dataset.error || "Fill in this field.";
          input.setAttribute("aria-describedby", msg.id);
          input.closest(".field").appendChild(msg);
        }
      });
      if (!valid) {
        ev.preventDefault();
        var first = form.querySelector("[aria-invalid='true']");
        if (first) first.focus();
        return;
      }
      // Demo mode: no action set, so show the confirmation in place.
      if (!form.getAttribute("action")) {
        ev.preventDefault();
        var status = document.querySelector("[data-form-status]");
        form.hidden = true;
        if (status) { status.hidden = false; status.focus(); }
      }
    });
  }

  // Current year in footer
  document.querySelectorAll("[data-year]").forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();
