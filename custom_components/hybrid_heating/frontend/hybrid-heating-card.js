// node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, ee = h.trustedTypes, te = ee ? ee.emptyScript : "", ne = h.reactiveElementPolyfillSupport, g = (e, t) => e, _ = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? te : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, v = (e, t) => !l(e, t), y = {
	attribute: !0,
	type: String,
	converter: _,
	reflect: !1,
	useDefault: !1,
	hasChanged: v
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var b = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = y) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? y;
	}
	static _$Ei() {
		if (this.hasOwnProperty(g("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(g("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(g("properties"))) {
			let e = this.properties, t = [...f(e), ...p(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? _ : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? _ : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? v)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
b.elementStyles = [], b.shadowRootOptions = { mode: "open" }, b[g("elementProperties")] = /* @__PURE__ */ new Map(), b[g("finalized")] = /* @__PURE__ */ new Map(), ne?.({ ReactiveElement: b }), (h.reactiveElementVersions ??= []).push("2.1.2");
// node_modules/lit-html/lit-html.js
var re = globalThis, ie = (e) => e, x = re.trustedTypes, ae = x ? x.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, oe = "$lit$", S = `lit$${Math.random().toFixed(9).slice(2)}$`, se = "?" + S, ce = `<${se}>`, C = document, w = () => C.createComment(""), T = (e) => e === null || typeof e != "object" && typeof e != "function", le = Array.isArray, ue = (e) => le(e) || typeof e?.[Symbol.iterator] == "function", de = "[ 	\n\f\r]", E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, fe = /-->/g, pe = />/g, D = RegExp(`>|${de}(?:([^\\s"'>=/]+)(${de}*=${de}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), me = /'/g, he = /"/g, ge = /^(?:script|style|textarea|title)$/i, _e = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), O = _e(1), k = _e(2), A = Symbol.for("lit-noChange"), j = Symbol.for("lit-nothing"), ve = /* @__PURE__ */ new WeakMap(), M = C.createTreeWalker(C, 129);
function ye(e, t) {
	if (!le(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ae === void 0 ? t : ae.createHTML(t);
}
var be = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = E;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === E ? c[1] === "!--" ? o = fe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = D) : (ge.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = D) : o = pe : o === D ? c[0] === ">" ? (o = i ?? E, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? D : c[3] === "\"" ? he : me) : o === he || o === me ? o = D : o === fe || o === pe ? o = E : (o = D, i = void 0);
		let d = o === D && e[t + 1].startsWith("/>") ? " " : "";
		a += o === E ? n + ce : l >= 0 ? (r.push(s), n.slice(0, l) + oe + n.slice(l) + S + d) : n + S + (l === -2 ? t : d);
	}
	return [ye(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, xe = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = be(t, n);
		if (this.el = e.createElement(l, r), M.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = M.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(oe)) {
					let t = u[o++], n = i.getAttribute(e).split(S), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? we : r[1] === "?" ? Te : r[1] === "@" ? Ee : P
					}), i.removeAttribute(e);
				} else e.startsWith(S) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ge.test(i.tagName)) {
					let e = i.textContent.split(S), t = e.length - 1;
					if (t > 0) {
						i.textContent = x ? x.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], w()), M.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], w());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === se) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(S, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += S.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = C.createElement("template");
		return n.innerHTML = e, n;
	}
};
function N(e, t, n = e, r) {
	if (t === A) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = T(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = N(e, i._$AS(e, t.values), i, r)), t;
}
var Se = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? C).importNode(t, !0);
		M.currentNode = r;
		let i = M.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Ce(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new De(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = M.nextNode(), a++);
		}
		return M.currentNode = C, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Ce = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = j, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = N(this, e, t), T(e) ? e === j || e == null || e === "" ? (this._$AH !== j && this._$AR(), this._$AH = j) : e !== this._$AH && e !== A && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ue(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== j && T(this._$AH) ? this._$AA.nextSibling.data = e : this.T(C.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = xe.createElement(ye(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Se(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ve.get(e.strings);
		return t === void 0 && ve.set(e.strings, t = new xe(e)), t;
	}
	k(t) {
		le(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(w()), this.O(w()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ie(e).nextSibling;
			ie(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, P = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = j, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = j;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = N(this, e, t, 0), a = !T(e) || e !== this._$AH && e !== A, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = N(this, r[n + o], t, o), s === A && (s = this._$AH[o]), a ||= !T(s) || s !== this._$AH[o], s === j ? e = j : e !== j && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === j ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, we = class extends P {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === j ? void 0 : e;
	}
}, Te = class extends P {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== j);
	}
}, Ee = class extends P {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = N(this, e, t, 0) ?? j) === A) return;
		let n = this._$AH, r = e === j && n !== j || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== j && (n === j || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, De = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		N(this, e);
	}
}, Oe = re.litHtmlPolyfillSupport;
Oe?.(xe, Ce), (re.litHtmlVersions ??= []).push("3.3.3");
var ke = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Ce(t.insertBefore(w(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ae = globalThis, F = class extends b {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = ke(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return A;
	}
};
F._$litElement$ = !0, F.finalized = !0, Ae.litElementHydrateSupport?.({ LitElement: F });
var je = Ae.litElementPolyfillSupport;
je?.({ LitElement: F }), (Ae.litElementVersions ??= []).push("4.2.2");
// src/api.ts
var Me = class extends Error {
	code;
	constructor(e, t) {
		super(t), this.code = e, this.name = "HhApiError";
	}
};
function Ne(e) {
	return typeof e == "object" && !!e && e.code === "unknown_command";
}
function Pe(e) {
	if (e instanceof Me) return e;
	let t = typeof e == "object" && e ? e : {};
	return new Me(String(t.code ?? "unknown_error"), String(t.message ?? e));
}
var Fe = class {
	getHass;
	constructor(e) {
		this.getHass = e;
	}
	async ws(e) {
		try {
			return await this.getHass().callWS(e);
		} catch (e) {
			throw Pe(e);
		}
	}
	async optional(e) {
		try {
			return await this.ws(e);
		} catch (e) {
			if (Ne(e)) return null;
			throw e;
		}
	}
	getConfig() {
		return this.ws({ type: "hybrid_heating/get_config" });
	}
	setConfig(e) {
		return this.ws({
			type: "hybrid_heating/set_config",
			settings: e
		});
	}
	getStatus(e) {
		return this.ws({
			type: "hybrid_heating/get_status",
			language: e
		});
	}
	async getLog(e, t = 20) {
		return (await this.ws({
			type: "hybrid_heating/get_log",
			limit: t,
			language: e
		})).entries;
	}
	async getPlan() {
		return (await this.optional({ type: "hybrid_heating/get_plan" }))?.plan ?? null;
	}
	getForecast() {
		return this.optional({ type: "hybrid_heating/get_forecast" });
	}
	async getSuggestions(e) {
		let t = await this.optional({
			type: "hybrid_heating/get_suggestions",
			language: e
		});
		return t ? t.suggestions : null;
	}
	applySuggestion(e, t) {
		return this.ws({
			type: "hybrid_heating/apply_suggestion",
			id: e,
			language: t
		});
	}
	async dismissSuggestion(e) {
		await this.ws({
			type: "hybrid_heating/dismiss_suggestion",
			id: e
		});
	}
	feedback(e, t, n) {
		return this.optional({
			type: "hybrid_heating/feedback",
			room: e,
			kind: t,
			language: n
		});
	}
	async setPreset(e, t) {
		await this.getHass().callService("select", "select_option", {
			entity_id: e,
			option: t
		});
	}
	async setHybrid(e, t) {
		await this.getHass().callService("switch", t ? "turn_on" : "turn_off", { entity_id: e });
	}
	async setEnabled(e, t) {
		await this.getHass().callService("switch", t ? "turn_on" : "turn_off", { entity_id: e });
	}
};
// src/dom.ts
function I(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function L(e, t) {
	customElements.get(e) || customElements.define(e, t);
}
// src/i18n/index.ts
var Ie = {
	en: {
		title: "Heating",
		"preset.comfort": "Comfort",
		"preset.eco": "Eco",
		"preset.night": "Night",
		"preset.away": "Away",
		"preset.group": "Mode",
		hybrid: "Hybrid mode",
		"room.living": "Living room",
		"room.bedroom": "Bedroom",
		"room.child": "Child's room",
		"room.bath": "Bathroom",
		"room_acc.living": "the living room",
		"room_acc.bedroom": "the bedroom",
		"room_low.living": "living room",
		"room_low.bedroom": "bedroom",
		"room_low.child": "child's room",
		"room_low.bath": "bathroom",
		"place.hall": "Hall",
		"place.wardrobe": "Wardrobe",
		"place.storage": "Storage",
		"zone.0": "Warm",
		"zone.1": "Cool",
		"zone.2": "Frost",
		"zone.3": "Severe frost",
		"zone.title": "Zone “{name}”",
		"ac.both": "both ACs",
		"ac.living": "living room AC",
		"ac.bedroom": "bedroom AC",
		"ac.none": "no ACs",
		"boiler_sum.off": "boiler off",
		"boiler_sum.backup": "boiler backup",
		"boiler_sum.main": "boiler main",
		"range.above": "above {t}",
		"range.below": "below {t}",
		"range.between": "from {from} to {to}",
		"boiler.off": "Off",
		"boiler.backup": "Backup",
		"boiler.main": "Main",
		"boiler_note.off": "The boiler does not run in this zone. If the ACs cannot keep up, the rooms cool down.",
		"boiler_note.backup": "The boiler watches the coldest room, usually the child’s room. The living room and the bedroom are heated by the ACs.",
		"boiler_note.main": "The boiler holds the room average. The ACs top up the living room and the bedroom.",
		"night.quiet": "quiet",
		"night.off": "off",
		"night.day": "as by day",
		"section.plan": "Apartment now",
		"section.why": "Why",
		"section.forecast": "Next 48 hours",
		"section.curve": "Boiler flow temperature",
		"section.probe": "What happens in this weather",
		"section.zone": "Zone settings",
		"section.rooms": "Rooms",
		"section.load": "Load limit",
		"section.season": "Heating season",
		"section.suggestions": "Suggestions",
		"section.log": "Decision log",
		loading: "Loading…",
		save: "Save",
		discard: "Discard",
		dirty: "Unsaved changes.",
		saved: "Settings saved.",
		read_only: "Only an administrator can change settings.",
		"error.not_set_up": "Hybrid Heating is not set up. Add the integration in Settings → Devices & services.",
		"error.not_loaded": "Hybrid Heating is starting or not loaded yet. The card tries again by itself.",
		"error.generic": "Hybrid Heating did not answer: {message}",
		"stage5.forecast": "The forecast arrives with the “Suggestions and forecast” update.",
		"stage5.suggestions": "Suggestions arrive with the “Suggestions and forecast” update.",
		"forecast.change": "{day}, around {hhmm} it will be {t}: zone “{zone}”, {summary}. ",
		"forecast.coldest": "Coldest {day} at {hhmm}, {t}: zone “{zone}”.",
		"rods.one": "{n} rod",
		"rods.few": "{n} rods",
		"rods.many": "{n} rods",
		"rods.other": "{n} rods",
		"hours.one": "{n} hour",
		"hours.few": "{n} hours",
		"hours.many": "{n} hours",
		"hours.other": "{n} hours",
		"plan.note": "Room colour: how much warmer or colder than the target.",
		"plan.schematic": "A sample layout. A plan of your own flat can be uploaded in the card settings.",
		"plan.aria": "Floor plan with room temperatures and running devices",
		"legend.cold": "colder than the target",
		"legend.heat": "warmer than the target",
		"legend.ac": "AC heating",
		"legend.rad": "radiator or floor heating on",
		"why.sub": "Outside {t}: zone “{zone}”. Target {target}° ({preset}).",
		"chip.flow": "Flow",
		"chip.rods": "Rods up to",
		"chip.load": "Load",
		"why.acs_on": "ACs are heating",
		"why.ac_on": "The AC is heating",
		"why.ac_on_text": "{who} to {target}°.",
		"why.and": " and ",
		"why.quiet": " Quiet mode: {list}.",
		"why.acs_off": "ACs are off:",
		"why.acs_off.hybrid": "hybrid mode is off.",
		"why.acs_off.away": "Away mode.",
		"why.acs_off.cold": "they do not heat below {t}.",
		"why.acs_off.zone": "they are off in this zone.",
		"why.acs_off.night": "off for the night.",
		"why.acs_off.unavailable": "they are unavailable.",
		"why.acs_off.observe": "the module only observes them.",
		"why.acs_off.idle": "not needed right now.",
		"why.ac_off.hybrid": "the AC is off: hybrid mode is off.",
		"why.ac_off.away": "the AC is off: Away mode.",
		"why.ac_off.cold": "the AC is off: it does not heat below {t}.",
		"why.ac_off.zone": "the AC is off in this zone.",
		"why.ac_off.night": "the AC is off for the night.",
		"why.ac_off.unavailable": "the AC is unavailable.",
		"why.ac_off.observe": "the AC is off; the module only observes it.",
		"why.ac_off.idle": "the AC is off for now.",
		"why.follows.coldest": "the room furthest below its target: {room}, {t}°",
		"why.follows.coldest_unknown": "the coldest room",
		"why.follows.average": "the room average, {t}°",
		"why.follows.average_unknown": "the room average",
		"why.part.curve": "curve {t}°",
		"why.part.bg": "ACs heating: −{t}°",
		"why.part.corr": "room correction {t}°",
		"why.smooth_on": "Radiators stay warm:",
		"why.smooth_on_text": "flow {flow}°{parts}. The boiler follows {follows}.",
		"why.smooth_paused": "The boiler is paused:",
		"why.smooth_paused_text": "rooms went more than {m}° above the target; it resumes when they are less than {r}° above. The boiler follows {follows}.",
		"why.boiler_off": "The boiler is off",
		"why.boiler_off_text": "in this zone.",
		"why.boiler_unavailable": "The boiler is unavailable:",
		"why.boiler_unavailable_text": "the module cannot drive it.",
		"why.classic_on": "The boiler is heating",
		"why.classic_on_text": "with flow {flow}°, rods up to {rods}. ",
		"why.classic_coldest": "The coldest is {room}, {t}°: below the threshold {thr}°.",
		"why.classic_average": "The room average {t}° is below the target {thr}°.",
		"why.classic_wait": "The boiler is waiting.",
		"why.classic_wait_text": "The coldest is {room}, {t}°. It starts below {thr}°.",
		"why.load_ok": "Load is fine:",
		"why.load_ok_text": "{spare} to spare before the limit.",
		"why.load_near": "Load is close to the limit:",
		"why.load_near_text": "{kw} of {limit}. Over the limit, the water heater and a boiler rod go first.",
		"why.load_over": "Load is over the limit:",
		"why.load_over_text": "{kw} of {limit}. Switched off: {what}.",
		"why.load_unknown": "Load:",
		"why.load_unknown_text": "no meter reading.",
		"why.water_heater": "the water heater",
		"banner.season": "Not the heating season: the module only shows data.",
		"banner.disabled": "The module is off: the heating runs without it.",
		"layer.boiler": "boiler",
		"layer.ac": "ACs",
		"layer.load": "load",
		"curve.note": "The boiler heats the water to this temperature depending on the weather. In smooth mode the radiators stay warm and the room correction moves the flow by up to ±{limit}°. It works without ACs too: switch hybrid mode off and the boiler follows the full curve.",
		"curve.legend.curve": "flow by the curve",
		"curve.legend.bg": "while the ACs heat",
		"curve.legend.now": "outside now",
		"curve.legend.probe": "check (click the chart)",
		"curve.shift": "Shift the whole curve",
		"curve.flow_min": "Flow at least",
		"curve.flow_max": "Flow at most",
		"curve.mode": "How the boiler works",
		"curve.bg": "Lower flow while the ACs heat",
		"mode.smooth": "Smooth: radiators always warm",
		"mode.classic": "On/off by thermostat",
		"zones.title": "What runs in which weather",
		"zones.note": "Move the zone boundaries on the strip under the chart. Tap a zone to change it.",
		"zones.hybrid_off": " (hybrid mode off)",
		"chart.aria": "Flow temperature by outdoor temperature, with the equipment zones",
		"chart.flow_axis": "flow, °C",
		"chart.out_axis": "← warmer · outside, °C · colder →",
		"chart.out_axis_short": "outside, °C",
		"chart.min": "at least {t}°",
		"chart.max": "at most {t}°",
		"chart.now": "now {t}",
		"chart.point": "Flow at {t}",
		"chart.bound": "Boundary between {a} and {b}",
		"unit.kwh": "kWh",
		"forecast.note": "The colour is the zone the heating will be in. Tap an hour to check it below.",
		"forecast.aria": "Temperature forecast for 48 hours with the heating zones",
		"forecast.per48": "{currency} in 48 h",
		"forecast.boiler_only": "boiler alone: {cost}",
		"forecast.empty": "No forecast yet.",
		"probe.note": "An estimate from your flat’s heat-loss model: about {h} W per degree of difference.",
		"probe.out": "Outside",
		"probe.zone": "zone “{name}”",
		"probe.now": "as now",
		"probe.legend.ac": "ACs",
		"probe.legend.boiler": "boiler",
		"probe.legend.short": "shortfall",
		"probe.flow": "Boiler flow",
		"probe.flow_bg": ", background",
		"probe.demand": "Heat needed",
		"probe.ac_living": "Living room AC",
		"probe.ac_bedroom": "Bedroom AC",
		"probe.off": "off",
		"probe.cop": "AC efficiency",
		"probe.boiler": "Boiler gives",
		"probe.boiler_off": "off",
		"probe.boiler_of": "{kw} of {cap}",
		"probe.kwh": "Electricity per day",
		"probe.cost": "Cost per day",
		"probe.saving": "Against the boiler alone",
		"probe.same": "the same",
		"probe.short": "Short by {kw}: the flat will cool down. Add a rod or switch the ACs on in this zone.",
		"zone_editor.range": "When it is {range} outside. The boiler flow always follows the curve.",
		"zone_editor.acs": "ACs in this zone",
		"zone_editor.ac_note": "The ACs hold the target by the room sensors, not by their own.",
		"zone_editor.ac_cold": "The ACs heat down to {t}. Below that they stop and the boiler gives all the heat.",
		"zone_editor.boiler": "Boiler",
		"zone_editor.rods": "Boiler rods, at most",
		"zone_editor.rods_note": "Up to {kw}. Load shedding may take a rod off for a while.",
		"rooms.note": "If a room is uncomfortable, tap “Cold” or “Hot”. The module takes it into account in its suggestions.",
		"rooms.note_plain": "Room temperatures against the target.",
		"rooms.night": "Night, {start}–{end}",
		"rooms.tolerance": "The boiler tops up when the coldest room is below the target by more than",
		"rooms.ac_night": "AC at night",
		"room_by.living": "AC and radiators",
		"room_by.bedroom": "AC and a radiator",
		"room_by.child": "Radiator only",
		"room_by.bath": "Floor heating",
		"feedback.cold": "Cold",
		"feedback.hot": "Hot",
		"feedback.kind.cold": "cold",
		"feedback.kind.hot": "hot",
		"feedback.toast": "Noted: {room}, {kind}",
		"load.note": "Keeps the whole flat under the power limit.",
		"load.limit": "Limit",
		"load.restore": "Restore below",
		"load.queue": "When the flat goes over the limit",
		"load.q1": "After {s} s over the limit, all at once: the boiler pauses for {p} s, the water heater switches off and a boiler rod comes off.",
		"load.q2": "Still over: another rod comes off every {step} s, down to one.",
		"load.q3": "Under {restore} for {min} min: rods come back one at a time, then the water heater. The ACs are never touched.",
		"load.now": "Now {kw} of {limit}. The scale goes to {scale} kW.",
		"load.now_unknown": "No meter reading.",
		"load.shedding_now": "Switched off now: {what}.",
		"load.shed_rods": "rods off: {n}",
		"season.note": "Whether the module heats at all, by the average outdoor temperature.",
		"season.mode": "Season",
		"season.mode.auto": "Auto",
		"season.mode.on": "Always on",
		"season.mode.off": "Always off",
		"season.threshold": "Heating while the average outdoor temperature is below",
		"season.window": "Averaging window",
		"season.hysteresis": "Hysteresis",
		"season.on": "Season on. {hours} h average: {t}.",
		"season.off": "Off season. {hours} h average: {t}.",
		"layers.title": "Control",
		"layers.boiler": "Boiler",
		"layers.ac": "ACs",
		"layers.load": "Load",
		"layer_mode.off": "Off",
		"layer_mode.observe": "Observe",
		"layer_mode.active": "Control",
		"layers.note": "Observe: the module logs its decisions but changes nothing. Suggested order: observe for 2–3 days, then boiler, then load, then ACs.",
		"suggestions.note": "The module compares its forecast with what actually happened, and with your feedback. It changes nothing by itself: it only suggests.",
		"suggestions.empty": "No suggestions right now.",
		"suggestion.kind.curve": "Curve",
		"suggestion.kind.heat_loss": "Model",
		"suggestion.kind.feedback": "Your feedback",
		"suggestion.apply": "Apply",
		"suggestion.dismiss": "Not now",
		"suggestion.applied": "Applied.",
		"suggestion.dismissed": "Dismissed. The module will not suggest this again in similar weather.",
		"suggestion.applied_toast": "Applied: {title}",
		"log.note": "What the module did and why. Handy for sorting out mistakes.",
		"log.empty": "No decisions yet.",
		"editor.title": "Title",
		"editor.sections": "Show sections",
		"editor.tariff": "Electricity price per kWh",
		"editor.currency": "Currency",
		"editor.plan": "Floor plan",
		"editor.plan_note": "Upload the plan JSON made by tools/dxf_to_plan.py. It is kept in Home Assistant with the module’s data, not in the dashboard.",
		"editor.plan_reset": "Use the sample layout",
		"editor.plan_done": "Plan uploaded.",
		"editor.plan_cleared": "Back to the sample layout.",
		"editor.plan_error": "Could not upload the plan: {message}",
		"tabs.label": "Sections of the card",
		"tab.now": "Now",
		"tab.curve": "Curve & zones",
		"tab.rooms": "Rooms & power",
		"tab.system": "System",
		"tab.unsaved": "unsaved changes",
		"status.observing": "Observing — nothing is changed",
		"status.in_control": "In control: {layers}",
		"status.observing_also": " · observing: {layers}",
		"status.all_off": "All layers are off",
		"hint.more": "More",
		"hint.less": "Less",
		"why.starting": "Starting:",
		"why.starting_text": "the module makes its first decision within a couple of minutes.",
		"why.obs.smooth_on": "Would keep the radiators warm:",
		"why.obs.smooth_on_text": "flow {flow}°{parts}. It would follow {follows}.",
		"why.obs.smooth_paused": "Would pause the boiler:",
		"why.obs.smooth_paused_text": "rooms went more than {m}° above the target; it would resume when they are less than {r}° above. It would follow {follows}.",
		"why.obs.boiler_off": "Would keep the boiler off",
		"why.obs.classic_on": "Would heat with the boiler",
		"why.obs.classic_wait": "The boiler would wait.",
		"why.obs.load_over_text": "{kw} of {limit}. Would switch off: {what}.",
		"why.season_idle": "Not the heating season:",
		"why.season_idle_text": "the boiler stays off.",
		"why.obs.season_idle_text": "the module would keep the boiler off.",
		"why.load_pause": "Paused for the load:",
		"why.load_pause_text": "the boiler waits {s} s while the load is over the limit.",
		"why.load_hold_text": "{kw} of {limit}: shedding starts if it stays over for {s} s.",
		"why.load_recover": "Load is back under the limit:",
		"why.load_recover_text": "back after {min} min under {restore}: {what}.",
		"why.obs.load_recover_text": "it would bring back after {min} min under {restore}: {what}.",
		"why.boiler_paused_word": "the boiler (paused)",
		"chip.flow_obs": "Module flow",
		"why.acs_hand": "ACs run by hand",
		"why.ac_hand": "The AC runs by hand",
		"why.ac_hand_who": "{room} ({t}°, set to {sp}°)",
		"why.ac_hand_who_nosp": "{room} ({t}°)",
		"why.ac_off.manual": "the AC runs by hand in {mode} mode.",
		"why.acs_off.manual": "they run by hand in another mode.",
		"why.ac_off.hand_off": "switched off by hand; it stays off until the preset changes.",
		"why.acs_off.hand_off": "switched off by hand; they stay off until the preset changes.",
		"why.ac_off.layer_off": "the module does not control this AC.",
		"why.acs_off.layer_off": "the module does not control them.",
		"hvac.cool": "cooling",
		"hvac.dry": "drying",
		"hvac.fan_only": "fan",
		"hvac.auto": "auto",
		"hvac.heat_cool": "auto",
		"status.off_season": " · not the heating season",
		"status.stale": "No new data since {hhmm}: the module is not updating",
		"load.shedding_obs": "Would switch off now: {what}.",
		"log.failed": "Failed: {n}",
		"log.skipped": "Skipped: {n}",
		"sum.starting": "Starting",
		"sum.unavailable": "Boiler unavailable",
		"sum.zone_off": "Boiler off",
		"sum.obs.zone_off": "Would keep the boiler off",
		"sum.season": "Not the heating season",
		"sum.on": "Radiators on, flow {flow}°",
		"sum.obs.on": "Would heat, flow {flow}°",
		"sum.paused": "Boiler paused",
		"sum.obs.paused": "Would pause the boiler",
		"sum.acs_on": "ACs heating",
		"sum.ac_on": "AC heating",
		"sum.acs_hand": "ACs run by hand",
		"sum.ac_hand": "AC runs by hand",
		"sum.acs_off": "ACs off",
		"sum.load": "load {kw} of {limit}",
		"sum.load_over": "load over the limit",
		"sum.load_unknown": "load unknown",
		"room.target": "target {t}°",
		"room.rads_on": "Radiators on",
		"room.rads_off": "Radiators off",
		"room.floor_on": "Floor heating on",
		"room.floor_off": "Floor heating off",
		"room.ac_module": "AC: heating, set to {sp}°",
		"room.ac_hand": "AC: run by hand, set to {sp}°",
		"room.ac_mode": "AC: run by hand in {mode} mode",
		"room.ac_off": "AC: off",
		"room.ac_unavailable": "AC: unavailable",
		close: "Close",
		"thermo.gap": "Your thermostat holds {th}°; the module’s target is {target}°.",
		"thermo.control": " In Control the module heats to {target}°: if that is too warm, lower the targets first."
	},
	ru: {
		title: "Отопление",
		"preset.comfort": "Комфорт",
		"preset.eco": "Эко",
		"preset.night": "Ночь",
		"preset.away": "Отъезд",
		"preset.group": "Режим",
		hybrid: "Гибридный режим",
		"room.living": "Гостиная",
		"room.bedroom": "Спальня",
		"room.child": "Детская",
		"room.bath": "Ванная",
		"room_acc.living": "гостиную",
		"room_acc.bedroom": "спальню",
		"room_low.living": "гостиная",
		"room_low.bedroom": "спальня",
		"room_low.child": "детская",
		"room_low.bath": "ванная",
		"place.hall": "Прихожая",
		"place.wardrobe": "Гардероб",
		"place.storage": "Кладовая",
		"zone.0": "Тепло",
		"zone.1": "Прохладно",
		"zone.2": "Мороз",
		"zone.3": "Сильный мороз",
		"zone.title": "Зона «{name}»",
		"ac.both": "оба кондиционера",
		"ac.living": "кондиционер в гостиной",
		"ac.bedroom": "кондиционер в спальне",
		"ac.none": "без кондиционеров",
		"boiler_sum.off": "котёл выкл",
		"boiler_sum.backup": "котёл на подстраховке",
		"boiler_sum.main": "котёл основной",
		"range.above": "выше {t}",
		"range.below": "ниже {t}",
		"range.between": "от {from} до {to}",
		"boiler.off": "Выкл",
		"boiler.backup": "Подстраховка",
		"boiler.main": "Основной",
		"boiler_note.off": "Котёл в этой зоне не включается. Если кондиционеры не справятся, комнаты остынут.",
		"boiler_note.backup": "Котёл следит за самой холодной комнатой, обычно за детской. Гостиную и спальню греют кондиционеры.",
		"boiler_note.main": "Котёл держит среднюю по комнатам. Кондиционеры добирают в гостиной и спальне.",
		"night.quiet": "тихо",
		"night.off": "выкл",
		"night.day": "как днём",
		"section.plan": "Квартира сейчас",
		"section.why": "Почему так",
		"section.forecast": "Ближайшие 48 часов",
		"section.curve": "Температура подачи котла",
		"section.probe": "Что будет при такой погоде",
		"section.zone": "Настройки зоны",
		"section.rooms": "Комнаты",
		"section.load": "Ограничение нагрузки",
		"section.season": "Отопительный сезон",
		"section.suggestions": "Подсказки модуля",
		"section.log": "Журнал решений",
		loading: "Загрузка…",
		save: "Сохранить",
		discard: "Сбросить",
		dirty: "Есть несохранённые изменения.",
		saved: "Настройки сохранены.",
		read_only: "Менять настройки может только администратор.",
		"error.not_set_up": "Hybrid Heating не настроен. Добавьте интеграцию в «Настройки → Устройства и службы».",
		"error.not_loaded": "Hybrid Heating ещё запускается или не загружен. Карточка попробует снова сама.",
		"error.generic": "Hybrid Heating не ответил: {message}",
		"stage5.forecast": "Прогноз появится с обновлением «Подсказки и прогноз».",
		"stage5.suggestions": "Подсказки появятся с обновлением «Подсказки и прогноз».",
		"forecast.change": "{day}, около {hhmm} станет {t}: зона «{zone}», {summary}. ",
		"forecast.coldest": "Холоднее всего {day} в {hhmm}, {t}: зона «{zone}».",
		"rods.one": "{n} ТЭН",
		"rods.few": "{n} ТЭНа",
		"rods.many": "{n} ТЭНов",
		"rods.other": "{n} ТЭНа",
		"hours.one": "{n} час",
		"hours.few": "{n} часа",
		"hours.many": "{n} часов",
		"hours.other": "{n} часа",
		"plan.note": "Цвет комнаты — насколько она теплее или холоднее цели.",
		"plan.schematic": "Это пример планировки. План своей квартиры можно загрузить в настройках карточки.",
		"plan.aria": "План квартиры с температурами в комнатах и работающими приборами",
		"legend.cold": "холоднее цели",
		"legend.heat": "теплее цели",
		"legend.ac": "кондиционер греет",
		"legend.rad": "радиатор или тёплый пол греет",
		"why.sub": "На улице {t}: зона «{zone}». Цель {target}° ({preset}).",
		"chip.flow": "Подача",
		"chip.rods": "ТЭНов до",
		"chip.load": "Нагрузка",
		"why.acs_on": "Кондиционеры греют",
		"why.ac_on": "Кондиционер греет",
		"why.ac_on_text": "{who} до {target}°.",
		"why.and": " и ",
		"why.quiet": " Тихий режим: {list}.",
		"why.acs_off": "Кондиционеры выключены:",
		"why.acs_off.hybrid": "гибридный режим выключен.",
		"why.acs_off.away": "режим «Отъезд».",
		"why.acs_off.cold": "ниже {t} они не греют.",
		"why.acs_off.zone": "в этой зоне они выключены.",
		"why.acs_off.night": "выключены на ночь.",
		"why.acs_off.unavailable": "они недоступны.",
		"why.acs_off.observe": "модуль только наблюдает за ними.",
		"why.acs_off.idle": "сейчас не нужны.",
		"why.ac_off.hybrid": "кондиционер выключен: гибридный режим выключен.",
		"why.ac_off.away": "кондиционер выключен: режим «Отъезд».",
		"why.ac_off.cold": "кондиционер выключен: ниже {t} он не греет.",
		"why.ac_off.zone": "кондиционер выключен в этой зоне.",
		"why.ac_off.night": "кондиционер выключен на ночь.",
		"why.ac_off.unavailable": "кондиционер недоступен.",
		"why.ac_off.observe": "кондиционер выключен, модуль только наблюдает за ним.",
		"why.ac_off.idle": "кондиционер сейчас выключен.",
		"why.follows.coldest": "за комнатой дальше всех от цели — {room}, {t}°",
		"why.follows.coldest_unknown": "за самой холодной комнатой",
		"why.follows.average": "за средней по комнатам — {t}°",
		"why.follows.average_unknown": "за средней по комнатам",
		"why.part.curve": "кривая {t}°",
		"why.part.bg": "кондиционеры греют: −{t}°",
		"why.part.corr": "поправка по комнатам {t}°",
		"why.smooth_on": "Радиаторы тёплые постоянно:",
		"why.smooth_on_text": "подача {flow}°{parts}. Котёл следит {follows}.",
		"why.smooth_paused": "Котёл на паузе:",
		"why.smooth_paused_text": "комнаты были теплее цели больше чем на {m}°; снова включится, когда превышение станет меньше {r}°. Котёл следит {follows}.",
		"why.boiler_off": "Котёл выключен",
		"why.boiler_off_text": "в этой зоне.",
		"why.boiler_unavailable": "Котёл недоступен:",
		"why.boiler_unavailable_text": "модуль не может им управлять.",
		"why.classic_on": "Котёл греет",
		"why.classic_on_text": "с подачей {flow}°, ТЭНов до {rods}. ",
		"why.classic_coldest": "Самая холодная — {room}, {t}°: ниже порога {thr}°.",
		"why.classic_average": "Средняя по комнатам {t}° ниже цели {thr}°.",
		"why.classic_wait": "Котёл ждёт.",
		"why.classic_wait_text": "Самая холодная — {room}, {t}°. Включится ниже {thr}°.",
		"why.load_ok": "Нагрузка в норме:",
		"why.load_ok_text": "запас {spare} до лимита.",
		"why.load_near": "Нагрузка близко к лимиту:",
		"why.load_near_text": "{kw} из {limit}. При превышении первыми отключатся бойлер и ТЭН.",
		"why.load_over": "Нагрузка выше лимита:",
		"why.load_over_text": "{kw} из {limit}. Отключено: {what}.",
		"why.load_unknown": "Нагрузка:",
		"why.load_unknown_text": "нет данных счётчика.",
		"why.water_heater": "бойлер",
		"banner.season": "Не отопительный сезон: модуль только показывает данные.",
		"banner.disabled": "Модуль выключен: отопление работает без него.",
		"layer.boiler": "котёл",
		"layer.ac": "кондиционеры",
		"layer.load": "нагрузка",
		"curve.note": "Котёл греет воду до этой температуры в зависимости от погоды. В плавном режиме радиаторы тёплые постоянно, а поправка по комнатам двигает подачу на ±{limit}°. Работает и без кондиционеров: выключите гибридный режим, и котёл пойдёт по полной кривой.",
		"curve.legend.curve": "подача по кривой",
		"curve.legend.bg": "пока греют кондиционеры",
		"curve.legend.now": "сейчас на улице",
		"curve.legend.probe": "проверка (клик по графику)",
		"curve.shift": "Сдвиг всей кривой",
		"curve.flow_min": "Подача не ниже",
		"curve.flow_max": "Подача не выше",
		"curve.mode": "Как работает котёл",
		"curve.bg": "Подача ниже, пока греют кондиционеры",
		"mode.smooth": "Плавно: батареи всегда тёплые",
		"mode.classic": "Вкл/выкл по термостату",
		"zones.title": "Что работает при какой погоде",
		"zones.note": "Границы зон двигаются на полосе под графиком. Нажмите на зону, чтобы изменить её.",
		"zones.hybrid_off": " (гибрид выключен)",
		"chart.aria": "График температуры подачи в зависимости от температуры на улице, с зонами работы оборудования",
		"chart.flow_axis": "подача, °C",
		"chart.out_axis": "← теплее · на улице, °C · холоднее →",
		"chart.out_axis_short": "на улице, °C",
		"chart.min": "не ниже {t}°",
		"chart.max": "не выше {t}°",
		"chart.now": "сейчас {t}",
		"chart.point": "Подача при {t}",
		"chart.bound": "Граница зон «{a}» и «{b}»",
		"unit.kwh": "кВт·ч",
		"forecast.note": "Цвет — зона, в которой окажется отопление. Нажмите на час, чтобы проверить его ниже.",
		"forecast.aria": "Прогноз температуры на 48 часов с зонами отопления",
		"forecast.per48": "{currency} за 48 ч",
		"forecast.boiler_only": "только котлом: {cost}",
		"forecast.empty": "Прогноза пока нет.",
		"probe.note": "Оценка по модели теплопотерь вашей квартиры: около {h} Вт на градус разницы.",
		"probe.out": "На улице",
		"probe.zone": "зона «{name}»",
		"probe.now": "как сейчас",
		"probe.legend.ac": "кондиционеры",
		"probe.legend.boiler": "котёл",
		"probe.legend.short": "не хватает",
		"probe.flow": "Подача котла",
		"probe.flow_bg": ", фон",
		"probe.demand": "Нужно тепла",
		"probe.ac_living": "Кондиционер в гостиной",
		"probe.ac_bedroom": "Кондиционер в спальне",
		"probe.off": "выкл",
		"probe.cop": "КПД кондиционеров",
		"probe.boiler": "Котёл даст",
		"probe.boiler_off": "выключен",
		"probe.boiler_of": "{kw} из {cap}",
		"probe.kwh": "Электричество за сутки",
		"probe.cost": "Стоимость за сутки",
		"probe.saving": "Против одного котла",
		"probe.same": "так же",
		"probe.short": "Не хватает {kw}: квартира будет остывать. Добавьте ТЭН или включите кондиционеры в этой зоне.",
		"zone_editor.range": "Когда на улице {range}. Подача котла всегда по кривой.",
		"zone_editor.acs": "Кондиционеры в этой зоне",
		"zone_editor.ac_note": "Кондиционеры держат цель по датчикам в комнатах, а не по своим встроенным.",
		"zone_editor.ac_cold": "Кондиционеры греют до {t}. Ниже они остановятся, и всё тепло даст котёл.",
		"zone_editor.boiler": "Котёл",
		"zone_editor.rods": "ТЭНы котла, максимум",
		"zone_editor.rods_note": "До {kw}. Сброс нагрузки может временно снять ТЭН.",
		"rooms.note": "Если где-то некомфортно, нажмите «Холодно» или «Жарко». Модуль учтёт это в подсказках.",
		"rooms.note_plain": "Температура в комнатах против цели.",
		"rooms.night": "Ночь, {start}–{end}",
		"rooms.tolerance": "Котёл подогревает, если самая холодная комната ниже цели больше чем на",
		"rooms.ac_night": "Кондиционер ночью",
		"room_by.living": "Кондиционер и радиаторы",
		"room_by.bedroom": "Кондиционер и радиатор",
		"room_by.child": "Только радиатор от котла",
		"room_by.bath": "Тёплый пол",
		"feedback.cold": "Холодно",
		"feedback.hot": "Жарко",
		"feedback.kind.cold": "холодно",
		"feedback.kind.hot": "жарко",
		"feedback.toast": "Учту: {room}, {kind}",
		"load.note": "Чтобы вся квартира не превышала лимит по мощности.",
		"load.limit": "Лимит",
		"load.restore": "Возвращать, когда ниже",
		"load.queue": "Если квартира превышает лимит",
		"load.q1": "Через {s} с превышения, сразу: пауза котла на {p} с, бойлер выключается, снимается один ТЭН.",
		"load.q2": "Если превышение не прошло: ещё по ТЭНу каждые {step} с, до одного.",
		"load.q3": "Ниже {restore} дольше {min} мин: ТЭНы возвращаются по одному, потом бойлер. Кондиционеры не трогаются.",
		"load.now": "Сейчас {kw} из {limit}. Шкала до {scale} кВт.",
		"load.now_unknown": "Нет данных счётчика.",
		"load.shedding_now": "Сейчас отключено: {what}.",
		"load.shed_rods": "ТЭНов снято: {n}",
		"season.note": "Работает ли отопление вообще — по средней температуре на улице.",
		"season.mode": "Сезон",
		"season.mode.auto": "Авто",
		"season.mode.on": "Всегда вкл",
		"season.mode.off": "Всегда выкл",
		"season.threshold": "Отопление идёт, пока средняя на улице ниже",
		"season.window": "Окно усреднения",
		"season.hysteresis": "Гистерезис",
		"season.on": "Сезон идёт. Средняя за {hours} ч: {t}.",
		"season.off": "Не сезон. Средняя за {hours} ч: {t}.",
		"layers.title": "Управление",
		"layers.boiler": "Котёл",
		"layers.ac": "Кондиционеры",
		"layers.load": "Нагрузка",
		"layer_mode.off": "Выкл",
		"layer_mode.observe": "Наблюдать",
		"layer_mode.active": "Управлять",
		"layers.note": "Наблюдение: модуль пишет решения в журнал, но ничего не меняет. Порядок запуска: наблюдение 2–3 дня, потом котёл, потом нагрузка, потом кондиционеры.",
		"suggestions.note": "Модуль сравнивает свой прогноз с тем, что получилось на деле, и с вашими отметками. Сам он ничего не меняет: только предлагает.",
		"suggestions.empty": "Подсказок пока нет.",
		"suggestion.kind.curve": "Кривая",
		"suggestion.kind.heat_loss": "Модель",
		"suggestion.kind.feedback": "Ваша отметка",
		"suggestion.apply": "Применить",
		"suggestion.dismiss": "Не надо",
		"suggestion.applied": "Применено.",
		"suggestion.dismissed": "Отклонено. Модуль больше не предложит это при похожей погоде.",
		"suggestion.applied_toast": "Применено: {title}",
		"log.note": "Что модуль сделал и почему. По этому журналу удобно разбирать ошибки.",
		"log.empty": "Решений пока нет.",
		"editor.title": "Заголовок",
		"editor.sections": "Показывать разделы",
		"editor.tariff": "Цена электричества за кВт·ч",
		"editor.currency": "Валюта",
		"editor.plan": "План квартиры",
		"editor.plan_note": "Загрузите JSON плана, сделанный tools/dxf_to_plan.py. Он хранится в Home Assistant вместе с данными модуля, а не в панели.",
		"editor.plan_reset": "Вернуть пример планировки",
		"editor.plan_done": "План загружен.",
		"editor.plan_cleared": "Снова пример планировки.",
		"editor.plan_error": "Не удалось загрузить план: {message}",
		"tabs.label": "Разделы карточки",
		"tab.now": "Сейчас",
		"tab.curve": "Кривая",
		"tab.rooms": "Комнаты и мощность",
		"tab.system": "Система",
		"tab.unsaved": "есть несохранённые изменения",
		"status.observing": "Наблюдение — ничего не меняется",
		"status.in_control": "Управляет: {layers}",
		"status.observing_also": " · наблюдает: {layers}",
		"status.all_off": "Все слои выключены",
		"hint.more": "Подробнее",
		"hint.less": "Короче",
		"why.starting": "Запуск:",
		"why.starting_text": "первое решение модуль примет в течение пары минут.",
		"why.obs.smooth_on": "Держал бы радиаторы тёплыми:",
		"why.obs.smooth_on_text": "подача {flow}°{parts}. Котёл следил бы {follows}.",
		"why.obs.smooth_paused": "Поставил бы котёл на паузу:",
		"why.obs.smooth_paused_text": "комнаты были теплее цели больше чем на {m}°; снова включил бы, когда превышение станет меньше {r}°. Котёл следил бы {follows}.",
		"why.obs.boiler_off": "Не включал бы котёл",
		"why.obs.classic_on": "Включил бы котёл",
		"why.obs.classic_wait": "Котёл ждал бы.",
		"why.obs.load_over_text": "{kw} из {limit}. Отключил бы: {what}.",
		"why.season_idle": "Не отопительный сезон:",
		"why.season_idle_text": "котёл не греет.",
		"why.obs.season_idle_text": "модуль не включал бы котёл.",
		"why.load_pause": "Пауза из-за нагрузки:",
		"why.load_pause_text": "котёл ждёт {s} с, пока нагрузка выше лимита.",
		"why.load_hold_text": "{kw} из {limit}: если продержится {s} с, начнётся отключение.",
		"why.load_recover": "Нагрузка снова в норме:",
		"why.load_recover_text": "возврат после {min} мин ниже {restore}: {what}.",
		"why.obs.load_recover_text": "вернул бы после {min} мин ниже {restore}: {what}.",
		"why.boiler_paused_word": "котёл (пауза)",
		"chip.flow_obs": "Подача модуля",
		"why.acs_hand": "Кондиционеры включены вручную",
		"why.ac_hand": "Кондиционер включён вручную",
		"why.ac_hand_who": "{room} ({t}°, уставка {sp}°)",
		"why.ac_hand_who_nosp": "{room} ({t}°)",
		"why.ac_off.manual": "кондиционер включён вручную в режиме «{mode}».",
		"why.acs_off.manual": "они включены вручную в другом режиме.",
		"why.ac_off.hand_off": "выключен вручную; не включится, пока не сменится режим.",
		"why.acs_off.hand_off": "выключены вручную; не включатся, пока не сменится режим.",
		"why.ac_off.layer_off": "модуль не управляет этим кондиционером.",
		"why.acs_off.layer_off": "модуль ими не управляет.",
		"hvac.cool": "охлаждение",
		"hvac.dry": "осушение",
		"hvac.fan_only": "вентилятор",
		"hvac.auto": "авто",
		"hvac.heat_cool": "авто",
		"status.off_season": " · не отопительный сезон",
		"status.stale": "Нет новых данных с {hhmm}: модуль не обновляется",
		"load.shedding_obs": "Отключил бы сейчас: {what}.",
		"log.failed": "Не выполнено: {n}",
		"log.skipped": "Пропущено: {n}",
		"sum.starting": "Запуск",
		"sum.unavailable": "Котёл недоступен",
		"sum.zone_off": "Котёл выключен",
		"sum.obs.zone_off": "Не включал бы котёл",
		"sum.season": "Не отопительный сезон",
		"sum.on": "Радиаторы греют, подача {flow}°",
		"sum.obs.on": "Грел бы, подача {flow}°",
		"sum.paused": "Котёл на паузе",
		"sum.obs.paused": "Поставил бы котёл на паузу",
		"sum.acs_on": "кондиционеры греют",
		"sum.ac_on": "кондиционер греет",
		"sum.acs_hand": "кондиционеры включены вручную",
		"sum.ac_hand": "кондиционер включён вручную",
		"sum.acs_off": "кондиционеры выключены",
		"sum.load": "нагрузка {kw} из {limit}",
		"sum.load_over": "нагрузка выше лимита",
		"sum.load_unknown": "нагрузка неизвестна",
		"room.target": "цель {t}°",
		"room.rads_on": "Радиаторы греют",
		"room.rads_off": "Радиаторы не греют",
		"room.floor_on": "Тёплый пол греет",
		"room.floor_off": "Тёплый пол не греет",
		"room.ac_module": "Кондиционер: греет, уставка {sp}°",
		"room.ac_hand": "Кондиционер: включён вручную, уставка {sp}°",
		"room.ac_mode": "Кондиционер: включён вручную, режим «{mode}»",
		"room.ac_off": "Кондиционер: выключен",
		"room.ac_unavailable": "Кондиционер: недоступен",
		close: "Закрыть",
		"thermo.gap": "Ваш термостат держит {th}°, цель модуля {target}°.",
		"thermo.control": " В режиме «Управлять» модуль будет греть до {target}°: если это слишком тепло, сначала поправьте цели."
	}
};
function Le(e) {
	return e && e.toLowerCase().startsWith("ru") ? "ru" : "en";
}
function R(e, t, n) {
	let r = Ie[e][t];
	return n ? r.replace(/{(\w+)}/g, (e, t) => t in n ? String(n[t]) : e) : r;
}
var Re = {
	en: new Intl.PluralRules("en"),
	ru: new Intl.PluralRules("ru")
};
function ze(e, t, n) {
	return R(e, `${t}.${Re[e].select(n)}`, { n });
}
// src/logic/config.ts
var Be = [
	"plan",
	"why",
	"forecast",
	"curve",
	"probe",
	"zone",
	"rooms",
	"load",
	"season",
	"suggestions",
	"log"
], Ve = (e) => Be.includes(e);
function He(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) throw Error("Invalid configuration");
	let t = e, n = t.hide_sections ?? [];
	if (!Array.isArray(n)) throw Error("hide_sections must be a list");
	for (let e of n) if (!Ve(e)) throw Error(`Unknown section: ${String(e)}`);
	let r = t.tariff_per_kwh;
	if (r !== void 0 && (typeof r != "number" || !Number.isFinite(r) || r < 0)) throw Error("tariff_per_kwh must be a number of at least 0");
	if (t.currency !== void 0 && typeof t.currency != "string") throw Error("currency must be text");
	if (t.title !== void 0 && typeof t.title != "string") throw Error("title must be text");
	return {
		...t,
		hide_sections: [...new Set(n)]
	};
}
// src/types.ts
var Ue = [
	"living",
	"bedroom",
	"child",
	"bath"
], z = ["living", "bedroom"], We = [
	"living",
	"bedroom",
	"child"
], Ge = [
	"comfort",
	"eco",
	"night",
	"away"
], Ke = [
	"boiler",
	"ac",
	"load"
];
// src/logic/hass.ts
function qe(e, t) {
	let n = e.states[t]?.state;
	return n === "on" || n !== "off" && null;
}
function Je(e, t) {
	let n = e.states[t.preset]?.state;
	return {
		hybrid: qe(e, t.hybrid),
		preset: Ge.includes(n) ? n : null,
		enabled: qe(e, t.enabled)
	};
}
function B(e) {
	return e.locale?.language ?? e.language;
}
function Ye(e, t, n, r = []) {
	return !e || e.themes?.darkMode !== t.themes?.darkMode || B(e) !== B(t) || e.user?.is_admin !== t.user?.is_admin || [...n ? [
		n.enabled,
		n.hybrid,
		n.preset,
		n.boiler_mode
	] : [], ...r].some((n) => e.states[n] !== t.states[n]);
}
// src/styles/tokens.ts
var Xe = o`
  :host {
    --bg: var(--primary-background-color);
    --surface: var(--ha-card-background, var(--card-background-color));
    --ink: var(--primary-text-color);
    --muted: var(--secondary-text-color);
    --line: var(--divider-color);
    --r: var(--ha-card-border-radius, 14px);
    --font-body: var(--ha-font-family-body, system-ui, sans-serif);
    --font-data: var(--ha-font-family-code, ui-monospace, Consolas, monospace);
    --line-strong: #bfc9d2;
    --wall: #2a323b;
    --heat: #d4502a;
    --cold: #2c74c4;
    --ac: #11908a;
    --mix: #b9840f;
    --deep: #a3322a;
    --ok: #2e8a4e;
    --ac-fill: rgba(17, 144, 138, 0.1);
    --mix-fill: rgba(185, 132, 15, 0.11);
    --heat-fill: rgba(212, 80, 42, 0.1);
    --deep-fill: rgba(163, 50, 42, 0.13);
    --warn-bg: #fff3dc;
    --warn-ink: #7e5300;
  }
  :host([dark]) {
    --line-strong: #38434e;
    --wall: #c9d2db;
    --heat: #ff7a4c;
    --cold: #62a6f0;
    --ac: #36c4bb;
    --mix: #e4b03c;
    --deep: #f2675b;
    --ok: #5ccb82;
    --ac-fill: rgba(54, 196, 187, 0.13);
    --mix-fill: rgba(228, 176, 60, 0.13);
    --heat-fill: rgba(255, 122, 76, 0.13);
    --deep-fill: rgba(242, 103, 91, 0.15);
    --warn-bg: #3a2b0e;
    --warn-ink: #f2c86c;
    color-scheme: dark;
  }
`, V = o`
  :host {
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.45;
  }
  * {
    box-sizing: border-box;
  }
  h1,
  h2,
  h3 {
    margin: 0;
    text-wrap: balance;
  }
  h1 {
    font-weight: 600;
    font-size: 28px;
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
  }
  p {
    margin: 0;
  }
  .num {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
  }
  .note {
    font-size: 12.5px;
    color: var(--muted);
  }
  .warn {
    background: var(--warn-bg);
    color: var(--warn-ink);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .card-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .head-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .btn {
    font: inherit;
    font-weight: 500;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    border-radius: 10px;
    padding: 8px 14px;
    cursor: pointer;
  }
  .btn.primary {
    background: var(--ink);
    color: var(--surface);
    border-color: var(--ink);
  }
  .btn.sm {
    padding: 5px 12px;
    font-size: 13px;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .field label,
  .field .lbl {
    font-size: 12px;
    color: var(--muted);
  }
  .field[hidden] {
    display: none;
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }
  button:focus-visible,
  input:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--cold);
    outline-offset: 2px;
  }
`, Ze = "hybrid-heating-plan-changed", Qe = class extends F {
	static properties = {
		hass: { attribute: !1 },
		_config: { state: !0 },
		_planNote: { state: !0 }
	};
	constructor() {
		super(), this._planNote = "";
	}
	static styles = [
		Xe,
		V,
		o`
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      input[type='text'],
      input[type='number'] {
        font: inherit;
        padding: 6px 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--ink);
      }
      .checks {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 6px 16px;
      }
      .checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--ink);
      }
    `
	];
	setConfig(e) {
		this._config = He(e);
	}
	get uiLang() {
		return Le(this.hass ? B(this.hass) : void 0);
	}
	change(e) {
		let t = {
			...this._config,
			...e
		};
		for (let [e, n] of Object.entries(t)) (n === void 0 || n === "") && delete t[e];
		this._config = He(t), I(this, "config-changed", { config: this._config });
	}
	toggle(e, t) {
		let n = this._config.hide_sections.filter((t) => t !== e);
		this.change({ hide_sections: t ? n : [...n, e] });
	}
	async setPlan(e) {
		let t = this.uiLang;
		try {
			await this.hass.callWS({
				type: "hybrid_heating/set_plan",
				plan: e
			}), this._planNote = R(t, e === null ? "editor.plan_cleared" : "editor.plan_done"), window.dispatchEvent(new CustomEvent(Ze));
		} catch (e) {
			let n = typeof e == "object" && e && "message" in e ? String(e.message) : String(e);
			this._planNote = R(t, "editor.plan_error", { message: n });
		}
	}
	async upload(e) {
		let t = e.target.files?.[0];
		if (t) try {
			await this.setPlan(JSON.parse(await t.text()));
		} catch (e) {
			this._planNote = R(this.uiLang, "editor.plan_error", { message: e.message });
		}
	}
	render() {
		let e = this._config;
		if (!e) return j;
		let t = this.uiLang, n = (e) => e.target.value.trim();
		return O`<div class="form">
      <div class="field">
        <label for="title">${R(t, "editor.title")}</label>
        <input
          type="text"
          id="title"
          name="title"
          placeholder=${R(t, "title")}
          .value=${e.title ?? ""}
          @change=${(e) => this.change({ title: n(e) || void 0 })}
        />
      </div>
      <div class="field">
        <span class="lbl">${R(t, "editor.sections")}</span>
        <div class="checks">
          ${Be.map((n) => O`<label>
              <input
                type="checkbox"
                name=${n}
                .checked=${!e.hide_sections.includes(n)}
                @change=${(e) => this.toggle(n, e.target.checked)}
              />${R(t, `section.${n}`)}
            </label>`)}
        </div>
      </div>
      <div class="pair">
        <div class="field">
          <label for="tariff">${R(t, "editor.tariff")}</label>
          <input
            type="number"
            id="tariff"
            name="tariff_per_kwh"
            min="0"
            step="0.01"
            .value=${e.tariff_per_kwh === void 0 ? "" : String(e.tariff_per_kwh)}
            @change=${(e) => this.change({ tariff_per_kwh: n(e) === "" ? void 0 : Number(n(e)) })}
          />
        </div>
        <div class="field">
          <label for="currency">${R(t, "editor.currency")}</label>
          <input
            type="text"
            id="currency"
            name="currency"
            placeholder="€"
            .value=${e.currency ?? ""}
            @change=${(e) => this.change({ currency: n(e) || void 0 })}
          />
        </div>
      </div>
      <div class="field">
        <label for="plan">${R(t, "editor.plan")}</label>
        <p class="note">${R(t, "editor.plan_note")}</p>
        <div class="pair">
          <input type="file" id="plan" name="plan_file" accept=".json,application/json" @change=${this.upload} />
          <button class="btn sm" type="button" @click=${() => this.setPlan(null)}>${R(t, "editor.plan_reset")}</button>
        </div>
        ${this._planNote ? O`<p class="small" role="status">${this._planNote}</p>` : j}
      </div>
    </div>`;
	}
}, H = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function U(e, t) {
	if (e === t) return !0;
	if (Array.isArray(e) && Array.isArray(t)) return e.length === t.length && e.every((e, n) => U(e, t[n]));
	if (H(e) && H(t)) {
		let n = Object.keys(e);
		return n.length === Object.keys(t).length && n.every((n) => U(e[n], t[n]));
	}
	return !1;
}
function $e(e, t) {
	if (!H(e) || !H(t)) return structuredClone(t);
	let n = { ...e };
	for (let [r, i] of Object.entries(t)) n[r] = H(i) && H(e[r]) ? $e(e[r], i) : structuredClone(i);
	return n;
}
function et(e, t) {
	return $e(structuredClone(e), t);
}
function tt(e, t) {
	if (!U(e, t)) {
		if (H(e) && H(t)) {
			let n = {};
			for (let r of Object.keys(t)) {
				let i = tt(e[r], t[r]);
				i !== void 0 && (n[r] = i);
			}
			return Object.keys(n).length ? n : void 0;
		}
		return structuredClone(t);
	}
}
function nt(e, t) {
	return tt({
		...e,
		preset: null,
		hybrid: null
	}, {
		...t,
		preset: null,
		hybrid: null
	}) ?? {};
}
function rt(e, t) {
	return Object.keys(nt(e, t)).length > 0;
}
function it(e, t, n) {
	if (U(e, n)) return structuredClone(t);
	if (H(e) && H(t) && H(n)) {
		let r = {};
		for (let i of /* @__PURE__ */ new Set([...Object.keys(t), ...Object.keys(n)])) {
			let a = it(e[i], t[i], n[i]);
			a !== void 0 && (r[i] = a);
		}
		return r;
	}
	return Array.isArray(e) && Array.isArray(t) && Array.isArray(n) && e.length === t.length && e.length === n.length ? n.map((n, r) => it(e[r], t[r], n)) : structuredClone(n);
}
function at(e, t, n) {
	return it(e, t, n);
}
function ot(e, t) {
	return {
		...e,
		hybrid: t.hybrid ?? e.hybrid,
		preset: t.preset ?? e.preset
	};
}
// src/logic/context.ts
var st = /* @__PURE__ */ new Map();
function ct(e, t) {
	let n = st.get(t);
	return n || (n = new Intl.DateTimeFormat("en-GB", {
		timeZone: t,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}), st.set(t, n)), Object.fromEntries(n.formatToParts(new Date(e)).map((e) => [e.type, e.value]));
}
function W(e, t) {
	let n = ct(e, t);
	return {
		hhmm: `${n.hour}:${n.minute}`,
		hour: Number(n.hour),
		dateKey: `${n.year}-${n.month}-${n.day}`
	};
}
function lt(e, t) {
	return {
		comfort: e.comfort,
		eco: e.eco,
		night: e.night,
		away: e.away
	}[t];
}
function ut(e, t) {
	let n = e.night_start.slice(0, 5), r = e.night_end.slice(0, 5);
	return n <= r ? n <= t && t < r : t >= n || t < r;
}
function dt(e, t, n) {
	let r = ut(e, n), i = t === "comfort" && r ? "night" : t;
	return [i, lt(e, i)];
}
function ft(e, t, n) {
	let r = new Date(e);
	return `${new Intl.DateTimeFormat(n === "ru" ? "ru-RU" : "en-GB", {
		timeZone: t,
		weekday: "short"
	}).format(r).replace(".", "")} ${Number(ct(e, t).day)}`;
}
// src/logic/format.ts
var pt = "−";
function G(e, t, n) {
	let r = Math.round(e * 10 ** t) / 10 ** t, i = (Object.is(r, -0) ? 0 : r).toFixed(t);
	return /^-0(\.0+)?$/.test(i) && (i = i.slice(1)), n === "ru" && (i = i.replace(".", ",")), i.startsWith("-") ? pt + i.slice(1) : i;
}
function K(e, t) {
	let n = Math.round(e * 10) / 10, r = G(n, +!Number.isInteger(n), t);
	return (n > 0 ? "+" : "") + r + "°";
}
function mt(e, t) {
	return G(e, Math.abs(e - Math.round(e)) < .01 ? 0 : 1, t) + "°";
}
function q(e, t) {
	return G(e, 1, t) + (t === "ru" ? " кВт" : " kW");
}
function ht(e, t) {
	let n = G(e, 1, t);
	return n.startsWith(pt) ? n : "+" + n;
}
function J(e, t) {
	return e == null || !Number.isFinite(e) ? "—" : t(e);
}
// src/logic/zones.ts
var gt = [
	"ac",
	"mix",
	"heat",
	"deep"
];
function _t(e, t) {
	for (let n = 0; n < e.length; n++) if (t >= e[n]) return n;
	return 3;
}
function vt(e, t, n) {
	let r = t === 0 ? 19 : e[t - 1] - 1, i = t === 2 ? -19 : e[t + 1] + 1, a = [...e];
	return a[t] = Math.min(r, Math.max(i, Math.round(n))), a;
}
function yt(e, t) {
	return t === 3 ? -20 : e[t];
}
function Y(e, t) {
	return R(t, `zone.${e}`);
}
function bt(e, t, n) {
	return e === 0 ? R(n, "range.above", { t: K(t[0], n) }) : e === 3 ? R(n, "range.below", { t: K(t[2], n) }) : R(n, "range.between", {
		from: K(t[e], n),
		to: K(t[e - 1], n)
	});
}
function xt(e, t) {
	let n = e.ac_rooms.includes("living"), r = e.ac_rooms.includes("bedroom");
	return n && r ? R(t, "ac.both") : n ? R(t, "ac.living") : r ? R(t, "ac.bedroom") : R(t, "ac.none");
}
function St(e, t) {
	let n = [xt(e, t), R(t, `boiler_sum.${e.boiler}`)];
	return e.boiler !== "off" && n.push(ze(t, "rods", e.max_rods)), n.join(" · ");
}
function Ct(e, t, n) {
	let r = e.policies.map((e, r) => r === t ? {
		...e,
		...n
	} : e);
	return {
		...e,
		policies: r
	};
}
function wt(e, t, n) {
	let r = e.policies[t].ac_rooms;
	return Ct(e, t, { ac_rooms: r.includes(n) ? r.filter((e) => e !== n) : [...r, n].sort() });
}
function Tt(e, t, n) {
	return Ct(e, t, { boiler: n });
}
function Et(e, t, n) {
	return Ct(e, t, { max_rods: n });
}
function Dt(e, t) {
	return t > 110 ? e : t > 52 ? e.split(" ").map((e) => e[0].toUpperCase()).join("") : "";
}
// src/logic/curve.ts
var Ot = (e, t, n) => Math.min(n, Math.max(t, e));
function kt(e, t) {
	let n = e.points;
	if (t >= n[0][0]) return n[0][1] + e.shift;
	for (let r = 0; r < n.length - 1; r++) {
		let [i, a] = n[r], [o, s] = n[r + 1];
		if (o <= t && t <= i) return a + (s - a) * (i - t) / (i - o) + e.shift;
	}
	return n[n.length - 1][1] + e.shift;
}
function At(e, t, n) {
	let r = n.hybrid && n.acActive ? e.ac_background_shift : 0;
	return Ot(kt(e, t) - r + (n.correction ?? 0), e.flow_min, e.flow_max);
}
function jt(e) {
	return Ot(Math.round(e * 2) / 2, 15, 85);
}
function Mt(e, t, n) {
	let r = e.points.map((e, r) => r === t ? [e[0], jt(n)] : [...e]);
	return {
		...e,
		points: r
	};
}
function Nt(e, t, n) {
	return Mt(e, t, e.points[t][1] + n);
}
function Pt(e, t = .25) {
	if (!e.hybrid || e.curve.ac_background_shift <= 0) return [];
	let n = [], r = null;
	for (let i = 0; i <= 40 / t; i++) {
		let a = 20 - i * t, o = e.zones.policies[_t(e.zones.bounds, a)];
		o.ac_rooms.length > 0 && o.boiler === "main" && a >= e.ac.min_outdoor ? (r || n.push(r = []), r.push([a, At(e.curve, a, {
			acActive: !0,
			hybrid: !0
		})])) : r = null;
	}
	return n;
}
// src/logic/model.ts
var Ft = 7, It = -15, Lt = 3 / 6.2, Rt = {
	h_w_per_k: 150,
	gains_w: 300,
	tariff_per_kwh: .25,
	currency: "€",
	rod_kw: 2,
	ac_rated_kw: {
		living: 3.5,
		bedroom: 2.7
	},
	ac_share: {
		living: .42,
		bedroom: .23
	}
};
function zt(e) {
	return {
		...Rt,
		...e ?? {}
	};
}
function Bt(e, t, n, r) {
	return Math.max(0, (e * (n - r) - t) / 1e3);
}
function Vt(e, t) {
	return t >= Ft ? e : t < It ? 0 : e * (Lt + (t - It) / 22 * .5161290322580645);
}
function Ht(e) {
	return e >= 15 ? 4.2 : e >= Ft ? 3.6 + (e - Ft) * (4.2 - 3.6) / 8 : 1.7 + (Math.max(e, It) - It) * (3.6 - 1.7) / 22;
}
function Ut(e, t, n, r = {}) {
	let i = _t(e.zones.bounds, n), a = e.zones.policies[i], o = r.target ?? lt(e.targets, e.preset), s = Bt(t.h_w_per_k, t.gains_w, o, n), c = {
		living: 0,
		bedroom: 0
	};
	for (let i of z) c[i] = e.hybrid && a.ac_rooms.includes(i) && n >= e.ac.min_outdoor && e.preset !== "away" && !(r.night && e.ac.night[i] === "off") ? Math.min(t.ac_share[i] * s, Vt(t.ac_rated_kw[i], n)) : 0;
	let l = c.living + c.bedroom, u = a.boiler === "off" ? 0 : a.max_rods * t.rod_kw, d = Math.min(Math.max(0, s - l), u), f = Math.max(0, s - l - d), p = l > 0, m = p && e.hybrid && a.boiler === "main", h = p ? Ht(n) : null;
	return {
		zone: i,
		demandKw: s,
		acKw: c,
		acTotalKw: l,
		boilerKw: d,
		boilerCapKw: u,
		shortKw: f,
		cop: h,
		electricKw: (h ? l / h : 0) + d,
		acActive: p,
		background: m,
		flow: At(e.curve, n, {
			acActive: m,
			hybrid: e.hybrid
		})
	};
}
function Wt(e, t) {
	let n = e.electricKw * 24, r = n * t.tariff_per_kwh, i = e.demandKw * 24 * t.tariff_per_kwh;
	return {
		kwh: n,
		cost: r,
		boilerOnlyCost: i,
		saving: i > 0 ? 1 - r / i : 0
	};
}
function Gt(e, t, n, r) {
	let i = 0, a = 0;
	for (let o of n) {
		let n = W(o.ts, r).hhmm, [, s] = dt(e.targets, e.preset, n), c = Ut(e, t, o.t_out, {
			target: s,
			night: e.preset === "night" || ut(e.targets, n)
		});
		i += c.electricKw, a += c.demandKw;
	}
	return {
		kwh: i,
		cost: i * t.tariff_per_kwh,
		boilerOnlyCost: a * t.tariff_per_kwh
	};
}
function Kt(e) {
	let t = Math.floor(Math.min(...e)) - 3, n = Math.ceil(Math.max(...e)) + 3, r = [];
	for (let e = Math.ceil((t + 1) / 5) * 5; e < n; e += 5) r.push(e);
	return {
		tmin: t,
		tmax: n,
		ticks: r
	};
}
function qt(e, t, n, r) {
	if (t.length === 0) return "";
	let i = (t) => _t(e.zones.bounds, t.t_out), a = i(t[0]), o = t.find((e) => i(e) !== a), s = t.reduce((e, t) => t.t_out < e.t_out ? t : e), c = "";
	if (o) {
		let t = i(o);
		c += R(r, "forecast.change", {
			day: ft(o.ts, n, r),
			hhmm: W(o.ts, n).hhmm,
			t: K(o.t_out, r),
			zone: Y(t, r),
			summary: St(e.zones.policies[t], r)
		});
	}
	return c += R(r, "forecast.coldest", {
		day: ft(s.ts, n, r),
		hhmm: W(s.ts, n).hhmm,
		t: K(s.t_out, r),
		zone: Y(i(s), r)
	}), c;
}
// src/logic/tabs.ts
var Jt = [
	{
		key: "now",
		rows: [{
			cls: "two",
			cols: [["plan"], ["why"]]
		}, {
			cls: "one",
			cols: [["forecast"]]
		}]
	},
	{
		key: "curve",
		rows: [{
			cls: "two",
			cols: [["curve"], ["zone", "probe"]]
		}]
	},
	{
		key: "rooms",
		rows: [{
			cls: "pair",
			cols: [["rooms"], ["load"]]
		}]
	},
	{
		key: "system",
		rows: [{
			cls: "pair",
			cols: [["season", "suggestions"], ["log"]]
		}]
	}
], Yt = (e) => e.rows.flatMap((e) => e.cols.flat());
function Xt(e) {
	return Jt.filter((t) => Yt(t).some((t) => !e.includes(t))).map((e) => e.key);
}
function Zt(e, t) {
	return e === "curve" || e === "zones" ? "curve" : e === "boiler" ? t === "mode" ? "curve" : t === "classic_coldest_tolerance" ? "rooms" : "system" : e === "targets" || e === "ac" || e === "load" || e === "room_offsets" ? "rooms" : "system";
}
function Qt(e) {
	let t = /* @__PURE__ */ new Set();
	for (let [n, r] of Object.entries(e)) {
		let e = r && typeof r == "object" && !Array.isArray(r) ? Object.keys(r) : [""];
		for (let r of e) t.add(Zt(n, r));
	}
	return t;
}
var $t = 21e4;
function en(e, t, n, r = {}) {
	if (e && r.nowMs !== void 0 && r.nowMs - Date.parse(e.now) > $t) return {
		text: R(n, "status.stale", { hhmm: W(e.now, r.tz ?? "UTC").hhmm }),
		tone: "warn"
	};
	if (e && !e.enabled) return {
		text: R(n, "banner.disabled"),
		tone: "warn"
	};
	let i = (e) => Ke.filter((n) => t.layers[n] === e).map((e) => R(n, `layer.${e}`)), a = i("active"), o = i("observe");
	if (e && !e.season_active && !a.length) return {
		text: R(n, "banner.season"),
		tone: "idle"
	};
	if (a.length) {
		let t = o.length ? R(n, "status.observing_also", { layers: o.join(", ") }) : "", r = e && !e.season_active ? R(n, "status.off_season") : "";
		return {
			text: R(n, "status.in_control", { layers: a.join(", ") }) + t + r,
			tone: "ok"
		};
	}
	return o.length ? {
		text: R(n, "status.observing"),
		tone: "warn"
	} : {
		text: R(n, "status.all_off"),
		tone: "idle"
	};
}
function tn(e) {
	let t = /^(.+?[.!?])\s+(?=\S)/u.exec(e);
	return t ? {
		first: t[1],
		rest: !0
	} : {
		first: e,
		rest: !1
	};
}
// src/logic/why.ts
var nn = /* @__PURE__ */ new Set([
	"outdoor_unavailable",
	"rooms_unavailable",
	"ac_not_coping",
	"rods_budget_exhausted"
]), rn = [
	"cool",
	"dry",
	"fan_only",
	"auto",
	"heat_cool"
], an = (e, t) => e.acs[t].available && e.acs[t].hvac === "heat", on = (e, t) => e.room_offsets[t] ?? 0;
function sn(e, t, n, r = "UTC") {
	let i = t.acs[e];
	return i.available ? i.hvac && i.hvac !== "off" && i.hvac !== "heat" ? "manual" : n.layers.ac === "off" ? "layer_off" : n.hybrid ? t.effective_preset === "away" ? "away" : t.t_out !== null && t.t_out < n.ac.min_outdoor ? "cold" : n.zones.policies[t.zone]?.ac_rooms.includes(e) ? (t.effective_preset === "night" || n.preset === "night" || ut(n.targets, W(t.now, r).hhmm)) && n.ac.night[e] === "off" ? "night" : n.layers.ac === "active" ? t.reasons.some((t) => (t.code === "ac_manual_hold" || t.code === "ac_manual_off") && t.data?.room === e) ? "hand_off" : "idle" : "observe" : "zone" : "hybrid" : "unavailable";
}
function cn(e, t) {
	return We.flatMap((n) => {
		let r = e.rooms[n];
		return r === null ? [] : [{
			room: n,
			temp: r,
			offset: on(t, n)
		}];
	});
}
function ln(e, t) {
	let n = cn(e, t);
	return n.length ? n.reduce((e, t) => t.temp - t.offset < e.temp - e.offset ? t : e) : null;
}
function un(e, t) {
	let n = cn(e, t);
	if (!n.length) return null;
	let r = (e) => n.reduce((t, n) => t + e(n), 0) / n.length;
	return {
		temp: r((e) => e.temp),
		target: e.target + r((e) => e.offset)
	};
}
var dn = (e) => J(e, (e) => `${Math.round(e)}°`);
function fn(e, t) {
	let n = z.filter((t) => an(e, t)), r = n.filter((n) => t.layers.ac === "active" && e.acs[n].owned);
	return {
		heating: n,
		byModule: r,
		byHand: n.filter((e) => !r.includes(e))
	};
}
function pn(e, t, n, r) {
	let { heating: i, byModule: a, byHand: o } = fn(e, t), s = { t: K(t.ac.min_outdoor, n) }, c = (i, a) => {
		let o = sn(i, e, t, r), c = e.acs[i].hvac ?? "", l = rn.includes(c) ? R(n, `hvac.${c}`) : c;
		return R(n, `why.${a ? "acs_off" : "ac_off"}.${o}`, {
			...s,
			mode: l
		});
	};
	if (!i.length) {
		let i = z.map((n) => sn(n, e, t, r));
		return i.every((e) => e === i[0]) ? [{
			pip: "idle",
			lead: R(n, "why.acs_off"),
			text: c(z[0], !0)
		}] : z.map((e) => ({
			pip: "idle",
			lead: `${R(n, `room.${e}`)}:`,
			text: c(e, !1)
		}));
	}
	let l = [];
	if (a.length) {
		let r = a.map((n) => e.target + on(t, n)), i = r.every((e) => e === r[0]), o = (t) => J(e.rooms[t], (e) => G(e, 1, n)), s = a.map((e, t) => i ? `${R(n, `room_acc.${e}`)} (${o(e)}°)` : `${R(n, `room_acc.${e}`)} (${o(e)}° → ${G(r[t], 1, n)}°)`).join(R(n, "why.and")), c = a.filter((t) => e.acs[t].quiet).map((e) => R(n, `ac.${e}`));
		l.push({
			pip: "ac",
			lead: R(n, a.length > 1 ? "why.acs_on" : "why.ac_on"),
			text: (i ? R(n, "why.ac_on_text", {
				who: s,
				target: G(r[0], 1, n)
			}) : `${s}.`) + (c.length ? R(n, "why.quiet", { list: c.join(", ") }) : "")
		});
	}
	if (o.length) {
		let t = o.map((t) => {
			let r = e.acs[t].setpoint, i = {
				room: R(n, `room_low.${t}`),
				t: J(e.rooms[t], (e) => G(e, 1, n))
			};
			return r === null ? R(n, "why.ac_hand_who_nosp", i) : R(n, "why.ac_hand_who", {
				...i,
				sp: G(r, 0, n)
			});
		}).join(R(n, "why.and"));
		l.push({
			pip: "ac",
			lead: R(n, o.length > 1 ? "why.acs_hand" : "why.ac_hand"),
			text: `${t}.`
		});
	}
	for (let e of z.filter((e) => !i.includes(e))) l.push({
		pip: "idle",
		lead: `${R(n, `room.${e}`)}:`,
		text: c(e, !1)
	});
	return l;
}
function mn(e, t, n) {
	let r = e.driver;
	if (r.mode === "average") {
		let i = un(e, t)?.temp ?? r.temp;
		return i === null ? R(n, "why.follows.average_unknown") : R(n, "why.follows.average", { t: G(i, 1, n) });
	}
	if (r.room === null) return R(n, "why.follows.coldest_unknown");
	let i = e.rooms[r.room] ?? r.temp;
	return i === null ? R(n, "why.follows.coldest_unknown") : R(n, "why.follows.coldest", {
		room: R(n, `room_low.${r.room}`),
		t: G(i, 1, n)
	});
}
function hn(e, t, n) {
	if (!e.decided) return {
		pip: "idle",
		lead: R(n, "why.starting"),
		text: R(n, "why.starting_text")
	};
	let r = t.layers.boiler !== "active", i = (e) => r ? `why.obs.${e}` : `why.${e}`, a = J(e.flow_target, (e) => String(Math.round(e)));
	if (!e.boiler.available) return {
		pip: "cold",
		lead: R(n, "why.boiler_unavailable"),
		text: R(n, "why.boiler_unavailable_text")
	};
	if (t.zones.policies[e.zone]?.boiler === "off") return {
		pip: "idle",
		lead: R(n, i("boiler_off")),
		text: R(n, "why.boiler_off_text")
	};
	if (!e.season_active) return {
		pip: "idle",
		lead: R(n, "why.season_idle"),
		text: R(n, i("season_idle_text"))
	};
	let o = e.boiler.wanted ?? e.boiler.call_on === !0;
	if (!o && t.layers.load === "active" && e.reasons.some((e) => e.code === "pause_boiler")) return {
		pip: "cold",
		lead: R(n, "why.load_pause"),
		text: R(n, "why.load_pause_text", { s: t.load.pause_s })
	};
	if (t.boiler.mode === "smooth") {
		if (!o) return {
			pip: "idle",
			lead: R(n, i("smooth_paused")),
			text: R(n, i("smooth_paused_text"), {
				m: G(t.boiler.overheat_margin, 1, n),
				r: G(t.boiler.resume_margin, 1, n),
				follows: mn(e, t, n)
			})
		};
		let r = [];
		return e.curve_flow !== null && r.push(R(n, "why.part.curve", { t: Math.round(e.curve_flow) })), e.background_shift > 0 && r.push(R(n, "why.part.bg", { t: G(e.background_shift, 0, n) })), e.correction !== 0 && r.push(R(n, "why.part.corr", { t: ht(e.correction, n) })), {
			pip: "heat",
			lead: R(n, i("smooth_on")),
			text: R(n, i("smooth_on_text"), {
				flow: a,
				parts: r.length ? ` (${r.join(", ")})` : "",
				follows: mn(e, t, n)
			})
		};
	}
	let s = ln(e, t), c = e.target + (s?.offset ?? 0) - t.boiler.classic_coldest_tolerance, l = G(c, 1, n);
	if (o) {
		let r = String(e.boiler.rods_limit ?? t.zones.policies[e.zone]?.max_rods ?? "—"), o = un(e, t), u = s && s.temp < c ? R(n, "why.classic_coldest", {
			room: R(n, `room_low.${s.room}`),
			t: G(s.temp, 1, n),
			thr: l
		}) : R(n, "why.classic_average", {
			t: J(o?.temp, (e) => G(e, 1, n)),
			thr: J(o?.target, (e) => G(e, 1, n))
		});
		return {
			pip: "heat",
			lead: R(n, i("classic_on")),
			text: R(n, "why.classic_on_text", {
				flow: a,
				rods: r
			}) + u
		};
	}
	return {
		pip: "idle",
		lead: R(n, i("classic_wait")),
		text: R(n, "why.classic_wait_text", {
			room: s ? R(n, `room_low.${s.room}`) : "—",
			t: J(s?.temp, (e) => G(e, 1, n)),
			thr: l
		})
	};
}
function gn(e, t, n) {
	let { kw: r } = e.load, i = q(t.load.limit_kw, n);
	if (r === null) return {
		pip: "idle",
		lead: R(n, "why.load_unknown"),
		text: R(n, "why.load_unknown_text")
	};
	let a = {
		kw: G(r, 1, n),
		limit: i
	}, o = t.layers.load === "active", s = r > t.load.limit_kw;
	if (e.load.shedding) {
		let r = [];
		e.load.water_heater_shed && r.push(R(n, "why.water_heater")), e.load.rods_shed > 0 && r.push(ze(n, "rods", e.load.rods_shed)), r.length || r.push(R(n, "why.boiler_paused_word"));
		let i = r.join(", ");
		return s ? {
			pip: "cold",
			lead: R(n, "why.load_over"),
			text: R(n, o ? "why.load_over_text" : "why.obs.load_over_text", {
				...a,
				what: i
			})
		} : {
			pip: "ok",
			lead: R(n, "why.load_recover"),
			text: R(n, o ? "why.load_recover_text" : "why.obs.load_recover_text", {
				min: Math.round(t.load.restore_after_s / 60),
				restore: q(t.load.restore_kw, n),
				what: i
			})
		};
	}
	if (s) return {
		pip: "cold",
		lead: R(n, "why.load_over"),
		text: R(n, "why.load_hold_text", {
			...a,
			s: t.load.shed_after_s
		})
	};
	let c = t.load.limit_kw - r;
	return c < 1 ? {
		pip: "cold",
		lead: R(n, "why.load_near"),
		text: R(n, "why.load_near_text", a)
	} : {
		pip: "ok",
		lead: R(n, "why.load_ok"),
		text: R(n, "why.load_ok_text", { spare: q(c, n) })
	};
}
function _n(e, t, n) {
	let r = t.layers.boiler !== "active", i = (e) => r ? `sum.obs.${e}` : `sum.${e}`, a;
	a = e.decided ? e.boiler.available ? t.zones.policies[e.zone]?.boiler === "off" ? R(n, i("zone_off")) : e.season_active ? e.boiler.wanted ?? e.boiler.call_on === !0 ? R(n, i("on"), { flow: dn(e.flow_target).replace("°", "") }) : R(n, i("paused")) : R(n, "sum.season") : R(n, "sum.unavailable") : R(n, "sum.starting");
	let { byModule: o, byHand: s } = fn(e, t), c = o.length ? R(n, o.length > 1 ? "sum.acs_on" : "sum.ac_on") : s.length ? R(n, s.length > 1 ? "sum.acs_hand" : "sum.ac_hand") : R(n, "sum.acs_off"), l = e.load.kw, u = l === null ? R(n, "sum.load_unknown") : l > t.load.limit_kw ? R(n, "sum.load_over") : R(n, "sum.load", {
		kw: G(l, 1, n),
		limit: q(t.load.limit_kw, n)
	});
	return [
		a,
		c,
		u
	].join(" · ");
}
function vn(e, t, n, r = "UTC") {
	let i = R(n, "why.sub", {
		t: J(e.t_out, (e) => K(e, n)),
		zone: Y(e.zone, n),
		target: G(e.target, 1, n),
		preset: R(n, `preset.${e.effective_preset}`).toLowerCase()
	}), a = [
		{
			label: R(n, t.layers.boiler === "active" ? "chip.flow" : "chip.flow_obs"),
			value: dn(e.flow_target)
		},
		{
			label: R(n, "chip.rods"),
			value: String(e.boiler.rods_limit ?? t.zones.policies[e.zone]?.max_rods ?? "—")
		},
		{
			label: R(n, "chip.load"),
			value: `${J(e.load.kw, (e) => G(e, 1, n))} / ${q(t.load.limit_kw, n)}`
		}
	], o = e.reasons.filter((e) => nn.has(e.code) && e.text).map((e) => ({
		pip: "cold",
		lead: "",
		text: e.text
	})), s = [
		...pn(e, t, n, r),
		hn(e, t, n),
		...o,
		gn(e, t, n)
	];
	return {
		summary: _n(e, t, n),
		sub: i,
		chips: a,
		items: s
	};
}
// src/plan/builtin.ts
var yn = {
	version: 1,
	viewBox: [
		-350,
		-350,
		12700,
		8700
	],
	walls: [
		[
			[-200, -200],
			[1500, -200],
			[1500, 0],
			[-200, 0]
		],
		[
			[3500, -200],
			[8800, -200],
			[8800, 0],
			[3500, 0]
		],
		[
			[10800, -200],
			[12200, -200],
			[12200, 0],
			[10800, 0]
		],
		[
			[-200, 8e3],
			[9e3, 8e3],
			[9e3, 8200],
			[-200, 8200]
		],
		[
			[10500, 8e3],
			[12200, 8e3],
			[12200, 8200],
			[10500, 8200]
		],
		[
			[-200, 0],
			[0, 0],
			[0, 5e3],
			[-200, 5e3]
		],
		[
			[-200, 6500],
			[0, 6500],
			[0, 8e3],
			[-200, 8e3]
		],
		[
			[12e3, 0],
			[12200, 0],
			[12200, 8e3],
			[12e3, 8e3]
		],
		[
			[6e3, 0],
			[6100, 0],
			[6100, 2e3],
			[6e3, 2e3]
		],
		[
			[6e3, 2900],
			[6100, 2900],
			[6100, 4550],
			[6e3, 4550]
		],
		[
			[6e3, 5150],
			[6100, 5150],
			[6100, 6200],
			[6e3, 6200]
		],
		[
			[6e3, 7e3],
			[6100, 7e3],
			[6100, 8e3],
			[6e3, 8e3]
		],
		[
			[7500, 0],
			[7600, 0],
			[7600, 3e3],
			[7500, 3e3]
		],
		[
			[7500, 3900],
			[7600, 3900],
			[7600, 5e3],
			[7500, 5e3]
		],
		[
			[7500, 5900],
			[7600, 5900],
			[7600, 8e3],
			[7500, 8e3]
		],
		[
			[7600, 4300],
			[12e3, 4300],
			[12e3, 4400],
			[7600, 4400]
		],
		[
			[3600, 4400],
			[6e3, 4400],
			[6e3, 4500],
			[3600, 4500]
		],
		[
			[3600, 4500],
			[3700, 4500],
			[3700, 8e3],
			[3600, 8e3]
		],
		[
			[3700, 5200],
			[6e3, 5200],
			[6e3, 5300],
			[3700, 5300]
		]
	],
	glass: [
		{
			x: 1500,
			y: -200,
			w: 2e3,
			h: 200
		},
		{
			x: -200,
			y: 5e3,
			w: 200,
			h: 1500
		},
		{
			x: 8800,
			y: -200,
			w: 2e3,
			h: 200
		},
		{
			x: 9e3,
			y: 8e3,
			w: 1500,
			h: 200
		}
	],
	bays: [],
	neutral: [[
		[6100, 0],
		[7500, 0],
		[7500, 8e3],
		[6100, 8e3]
	], [
		[3700, 4500],
		[6e3, 4500],
		[6e3, 5200],
		[3700, 5200]
	]],
	rooms: {
		living: {
			polygons: [[
				[0, 0],
				[6e3, 0],
				[6e3, 4400],
				[3600, 4400],
				[3600, 8e3],
				[0, 8e3]
			]],
			label: [2600, 3e3]
		},
		bedroom: {
			polygons: [[
				[7600, 0],
				[12e3, 0],
				[12e3, 4300],
				[7600, 4300]
			]],
			label: [9800, 2300]
		},
		child: {
			polygons: [[
				[7600, 4400],
				[12e3, 4400],
				[12e3, 8e3],
				[7600, 8e3]
			]],
			label: [9800, 6100]
		},
		bath: {
			polygons: [[
				[3700, 5300],
				[6e3, 5300],
				[6e3, 8e3],
				[3700, 8e3]
			]],
			label: [4850, 6650]
		}
	},
	small_labels: [{
		key: "hall",
		at: [6800, 4300]
	}, {
		key: "wardrobe",
		at: [4850, 4850]
	}],
	radiators: [
		{
			room: "living",
			x: 1700,
			y: 80,
			w: 1600,
			h: 100,
			sections: null
		},
		{
			room: "living",
			x: 80,
			y: 5150,
			w: 100,
			h: 1200,
			sections: null
		},
		{
			room: "bedroom",
			x: 9e3,
			y: 80,
			w: 1600,
			h: 100,
			sections: null
		},
		{
			room: "child",
			x: 9050,
			y: 7820,
			w: 1400,
			h: 100,
			sections: null
		}
	],
	acs: {
		living: {
			x: 4300,
			y: 100,
			w: 900,
			h: 210,
			cx: 4750,
			from: 310,
			to: 1400
		},
		bedroom: {
			x: 10700,
			y: 4040,
			w: 900,
			h: 210,
			cx: 11150,
			from: 4040,
			to: 2940
		}
	},
	floor_heating: [{
		room: "bath",
		x: 3800,
		y: 5400,
		w: 2100,
		h: 2500
	}]
};
L("hh-tabs", class extends F {
	static properties = {
		tabs: { attribute: !1 },
		value: {},
		label: {},
		dirtyLabel: {}
	};
	focusAfterUpdate = null;
	constructor() {
		super(), this.tabs = [], this.value = "", this.label = "", this.dirtyLabel = "";
	}
	static styles = [V, o`
      :host {
        display: block;
        container-type: inline-size;
      }
      [role='tablist'] {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--line);
        overflow-x: auto;
        scrollbar-width: none;
      }
      button {
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        border: 0;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        background: transparent;
        color: var(--muted);
        padding: 10px 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      button:hover {
        color: var(--ink);
      }
      button[aria-selected='true'] {
        color: var(--ink);
        border-bottom-color: var(--ink);
      }
      @container (max-width: 480px) {
        [role='tablist'] {
          gap: 0;
        }
        button {
          padding: 9px 8px;
          font-size: 13px;
        }
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--heat);
      }
    `];
	select(e, t = !1) {
		t && (this.focusAfterUpdate = e), e !== this.value && I(this, "hh-tab", { key: e });
	}
	onKey(e) {
		let t = this.tabs.findIndex((e) => e.key === this.value), n = this.tabs.length - 1, r = {
			ArrowRight: t + 1,
			ArrowLeft: t - 1,
			Home: 0,
			End: n
		}[e.key];
		r !== void 0 && this.tabs.length && (e.preventDefault(), this.select(this.tabs[(r + this.tabs.length) % this.tabs.length].key, !0));
	}
	updated() {
		this.focusAfterUpdate === this.value && (this.renderRoot.querySelector(`#tab-${this.value}`)?.focus(), this.focusAfterUpdate = null);
	}
	render() {
		return O`<div role="tablist" aria-label=${this.label} @keydown=${this.onKey}>
      ${this.tabs.map((e) => O`<button
          type="button"
          role="tab"
          id="tab-${e.key}"
          aria-selected=${String(e.key === this.value)}
          tabindex=${e.key === this.value ? 0 : -1}
          ?data-dirty=${e.dirty}
          @click=${() => this.select(e.key)}
        >
          ${e.label}${e.dirty ? O`<span class="dot" role="img" aria-label=${this.dirtyLabel}></span>` : j}
        </button>`)}
    </div>`;
	}
}), L("hh-hint", class extends F {
	static properties = {
		text: {},
		lang: {},
		open: { state: !0 }
	};
	constructor() {
		super(), this.text = "", this.lang = "en", this.open = !1;
	}
	static styles = [V, o`
      :host {
        display: block;
      }
      .more {
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--muted);
        padding: 0 2px;
        cursor: pointer;
      }
      .more:hover {
        color: var(--ink);
      }
    `];
	render() {
		let { first: e, rest: t } = tn(this.text);
		return O`<p class="note">
      ${this.open || !t ? this.text : e}
      ${t ? O`<button
            class="more"
            type="button"
            aria-expanded=${String(this.open)}
            aria-label=${R(this.lang, this.open ? "hint.less" : "hint.more")}
            @click=${() => this.open = !this.open}
          >
            ${this.open ? "−" : "ⓘ"}
          </button>` : j}
    </p>`;
	}
}), L("hh-seg", class extends F {
	static properties = {
		options: { attribute: !1 },
		value: {},
		label: {},
		small: { type: Boolean },
		disabled: { type: Boolean }
	};
	constructor() {
		super(), this.options = [], this.value = "", this.label = "", this.small = !1, this.disabled = !1;
	}
	static styles = [V, o`
      :host {
        display: inline-flex;
      }
      .seg {
        display: inline-flex;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 2px;
        gap: 2px;
        flex-wrap: wrap;
      }
      button {
        font: inherit;
        font-size: 13px;
        border: 0;
        background: transparent;
        color: var(--ink);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
      }
      .small button {
        padding: 3px 9px;
        font-size: 12px;
      }
      button[aria-pressed='true'] {
        background: var(--ink);
        color: var(--surface);
      }
      button:disabled {
        cursor: default;
      }
      button:disabled:not([aria-pressed='true']) {
        opacity: 0.45;
      }
    `];
	render() {
		return O`<div class="seg ${this.small ? "small" : ""}" role="group" aria-label=${this.label || this.ariaLabel || ""}>
      ${this.options.map((e) => O`<button
          type="button"
          aria-pressed=${String(e.value === this.value)}
          ?disabled=${this.disabled}
          @click=${() => e.value !== this.value && I(this, "hh-select", { value: e.value })}
        >
          ${e.label}
        </button>`)}
    </div>`;
	}
});
// src/logic/steppers.ts
var bn = {
	"curve.flow_min": {
		min: 20,
		max: 45,
		step: 1
	},
	"curve.flow_max": {
		min: 50,
		max: 80,
		step: 1
	},
	"curve.ac_background_shift": {
		min: 0,
		max: 8,
		step: 1
	},
	"targets.comfort": {
		min: 18,
		max: 26,
		step: .1
	},
	"targets.night": {
		min: 16,
		max: 26,
		step: .1
	},
	"targets.eco": {
		min: 16,
		max: 26,
		step: .1
	},
	"targets.away": {
		min: 10,
		max: 20,
		step: .5
	},
	"boiler.classic_coldest_tolerance": {
		min: .3,
		max: 2,
		step: .1
	},
	"load.limit_kw": {
		min: 6,
		max: 10,
		step: .5
	},
	"load.restore_kw": {
		min: 3,
		max: 9.5,
		step: .5
	},
	"season.threshold": {
		min: 10,
		max: 22,
		step: .5
	},
	"season.window_hours": {
		min: 1,
		max: 48,
		step: 1
	},
	"season.hysteresis": {
		min: .5,
		max: 3,
		step: .5
	}
}, xn = (e) => Math.round(e * 100) / 100, Sn = (e, t, n) => Math.min(n, Math.max(t, e));
function Cn(e, t) {
	let [n, r] = t.split(".");
	return e[n][r];
}
function wn(e, t, n) {
	let [r, i] = t.split(".");
	return et(e, { [r]: { [i]: n } });
}
function Tn(e, t, n) {
	let r = bn[t], i = Sn(xn(Cn(e, t) + n * r.step), r.min, r.max);
	t === "load.restore_kw" && (i = Math.min(i, xn(e.load.limit_kw - .5))), t === "curve.flow_min" && (i = Math.min(i, e.curve.flow_max - 5)), t === "curve.flow_max" && (i = Math.max(i, e.curve.flow_min + 5));
	let a = wn(e, t, i);
	return t === "load.limit_kw" && (a = wn(a, "load.restore_kw", Math.min(e.load.restore_kw, xn(i - .5)))), a;
}
function En(e, t) {
	return et(e, { curve: { shift: Sn(Math.round(t), -10, 10) } });
}
L("hh-stepper", class extends F {
	static properties = {
		text: {},
		label: {},
		disabled: { type: Boolean }
	};
	constructor() {
		super(), this.text = "", this.label = "", this.disabled = !1;
	}
	static styles = [V, o`
      :host {
        display: inline-flex;
      }
      .stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }
      button {
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--ink);
        width: 32px;
        height: 32px;
        cursor: pointer;
        font-size: 16px;
      }
      button:hover:not(:disabled) {
        background: var(--bg);
      }
      button:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .val {
        min-width: 64px;
        text-align: center;
        font-family: var(--font-data);
        font-size: 13px;
        padding: 0 4px;
      }
    `];
	step(e) {
		I(this, "hh-step", { dir: e });
	}
	render() {
		return O`<div class="stepper" role="group" aria-label=${this.label}>
      <button type="button" aria-label="${this.label} −" ?disabled=${this.disabled} @click=${() => this.step(-1)}>−</button>
      <span class="val" aria-live="polite">${this.text}</span>
      <button type="button" aria-label="${this.label} +" ?disabled=${this.disabled} @click=${() => this.step(1)}>+</button>
    </div>`;
	}
});
// src/components/fields.ts
function X(e, t, n, r, i, a) {
	return O`<div class="field">
    <span class="lbl">${r}</span>
    <hh-stepper
      .label=${r}
      .text=${i}
      .disabled=${a}
      @hh-step=${(r) => I(e, "hh-edit", { next: Tn(t, n, r.detail.dir) })}
    ></hh-stepper>
  </div>`;
}
// src/components/width.ts
var Dn = class {
	host;
	width = 0;
	observer;
	constructor(e) {
		this.host = e, e.addController(this);
	}
	hostConnected() {
		this.observer = new ResizeObserver(([e]) => {
			let t = Math.round(e?.contentRect.width ?? 0);
			t && t !== this.width && requestAnimationFrame(() => {
				this.width = t, this.host.requestUpdate();
			});
		}), this.observer.observe(this.host);
	}
	hostDisconnected() {
		this.observer?.disconnect();
	}
};
// src/logic/chart-geometry.ts
function On(e) {
	let t = Math.max(300, e || 640), n = t < 560 ? 340 : 390, r = t - 16, i = n - 92;
	return {
		W: t,
		H: n,
		L: 40,
		R: r,
		T: 30,
		B: i,
		sy: i + 30,
		sh: 34,
		x: (e) => 40 + (20 - e) / 40 * (r - 40),
		y: (e) => i - (e - 25) / 50 * (i - 30),
		tx: (e) => 20 - (e - 40) / (r - 40) * 40,
		fy: (e) => 25 + (i - e) / (i - 30) * 50
	};
}
var kn = (e, t) => e.map(([e, n], r) => `${r ? "L" : "M"}${t.x(e).toFixed(1)} ${t.y(n).toFixed(1)}`).join(" ");
function An(e, t) {
	let n = [];
	for (let t = 0; t <= 160; t++) {
		let r = 20 - t * .25;
		n.push([r, At(e.curve, r, {
			acActive: !1,
			hybrid: !1
		})]);
	}
	return kn(n, t);
}
function jn(e, t) {
	return Pt(e).map((e) => kn(e, t)).join(" ");
}
function Z(e) {
	return Math.min(20, Math.max(-20, Math.round(e * 2) / 2));
}
function Mn(e, t) {
	return Math.round(t.tx(e));
}
function Nn(e) {
	return Math.min(16, (e.R - e.L) / 16 - 1);
}
function Pn(e, t, n) {
	return (t.R - t.L) / 8 >= 44 || e % 2 == 0 || e === n;
}
// src/sections/hh-curve-chart.ts
var Q = (e, t, n) => Math.min(n, Math.max(t, e));
L("hh-curve-chart", class extends F {
	static properties = {
		settings: { attribute: !1 },
		tOut: { attribute: !1 },
		ui: { attribute: !1 },
		lang: {},
		readOnly: { type: Boolean },
		hover: { state: !0 },
		drag: { state: !0 },
		focused: { state: !0 }
	};
	size = new Dn(this);
	constructor() {
		super(), this.settings = null, this.tOut = null, this.ui = null, this.lang = "en", this.readOnly = !1, this.hover = null, this.drag = null, this.focused = null;
	}
	static styles = [V, o`
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        /* a swipe on the chart still scrolls the page; the points and grips take the touch themselves */
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .grid-l {
        stroke: var(--line);
        stroke-width: 1;
      }
      .grid-z {
        stroke: var(--line-strong);
        stroke-width: 1;
      }
      .tick {
        fill: var(--muted);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .axis-t {
        fill: var(--muted);
        font-size: 11px;
      }
      .clamp {
        stroke: var(--muted);
        stroke-width: 1;
        stroke-dasharray: 3 4;
        opacity: 0.7;
      }
      .clamp-t {
        fill: var(--muted);
        font-size: 10.5px;
      }
      .curve {
        fill: none;
        stroke: var(--heat);
        stroke-width: 3;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .curve-bg {
        fill: none;
        stroke: var(--heat);
        stroke-width: 2;
        stroke-dasharray: 6 5;
        opacity: 0.75;
        stroke-linecap: round;
      }
      .pt {
        fill: var(--surface);
        stroke: var(--heat);
        stroke-width: 2.5;
      }
      .pt-hit {
        fill: transparent;
        cursor: ns-resize;
        touch-action: none;
      }
      .pt-hit:focus {
        outline: none;
      }
      .pt-hit:focus-visible + .pt,
      .pt.active {
        stroke-width: 4;
      }
      .pt-label {
        fill: var(--ink);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .now-l {
        stroke: var(--cold);
        stroke-width: 1.5;
        stroke-dasharray: 4 4;
      }
      .now-t {
        fill: var(--cold);
        font-size: 11.5px;
        font-weight: 600;
      }
      .probe-l {
        stroke: var(--ink);
        stroke-width: 1;
      }
      .probe-d {
        fill: var(--ink);
      }
      .probe-t {
        fill: var(--ink);
        font-size: 11.5px;
        font-weight: 600;
      }
      .hover-l {
        stroke: var(--muted);
        stroke-width: 1;
        stroke-dasharray: 2 3;
      }
      .hover-t {
        fill: var(--muted);
        font-size: 11px;
        font-family: var(--font-data);
      }
      .band-ac {
        fill: var(--ac-fill);
      }
      .band-mix {
        fill: var(--mix-fill);
      }
      .band-heat {
        fill: var(--heat-fill);
      }
      .band-deep {
        fill: var(--deep-fill);
      }
      .strip {
        cursor: pointer;
      }
      .strip:focus {
        outline: none;
      }
      .strip:focus-visible {
        stroke-width: 3;
        stroke-dasharray: 4 3;
      }
      .strip-ac {
        fill: var(--ac-fill);
        stroke: var(--ac);
      }
      .strip-mix {
        fill: var(--mix-fill);
        stroke: var(--mix);
      }
      .strip-heat {
        fill: var(--heat-fill);
        stroke: var(--heat);
      }
      .strip-deep {
        fill: var(--deep-fill);
        stroke: var(--deep);
      }
      .strip-t {
        fill: var(--ink);
        font-size: 12px;
        font-weight: 500;
        pointer-events: none;
      }
      .bnd-l {
        stroke: var(--line-strong);
        stroke-width: 1;
        stroke-dasharray: 2 3;
      }
      .grip {
        fill: var(--surface);
        stroke: var(--ink);
        stroke-width: 1.5;
      }
      .grip-hit {
        fill: transparent;
        cursor: ew-resize;
        touch-action: none;
      }
      .grip-hit:focus {
        outline: none;
      }
      .grip-hit:focus-visible + .grip {
        stroke-width: 3;
      }
      .grip-line {
        stroke: var(--ink);
        stroke-width: 1;
        pointer-events: none;
      }
      .bnd-t {
        fill: var(--ink);
        font-family: var(--font-data);
        font-size: 11px;
      }
      :host([read-only]) .pt-hit,
      :host([read-only]) .grip-hit {
        cursor: default;
      }
    `];
	willUpdate() {
		this.toggleAttribute("read-only", this.readOnly);
	}
	get g() {
		return On(this.size.width);
	}
	flow(e) {
		return At(this.settings.curve, e, {
			acActive: !1,
			hybrid: !1
		});
	}
	edit(e) {
		I(this, "hh-edit", { next: e });
	}
	setUi(e) {
		I(this, "hh-ui", e);
	}
	at(e) {
		let t = e.currentTarget.getBoundingClientRect(), n = this.g;
		return {
			px: (e.clientX - t.left) * n.W / t.width,
			py: (e.clientY - t.top) * n.H / t.height
		};
	}
	inPlot(e, t) {
		let n = this.g;
		return e >= n.L && e <= n.R && t >= n.T && t <= n.B;
	}
	onDown(e) {
		let t = e.target, n = t.closest("[data-drag]"), r = t.closest("[data-zone]"), i = e.currentTarget;
		if (n && !this.readOnly) {
			this.drag = {
				k: n.dataset.drag,
				i: Number(n.dataset.i)
			}, i.setPointerCapture(e.pointerId), e.preventDefault();
			return;
		}
		if (r) {
			this.setUi({ sel: Number(r.dataset.zone) });
			return;
		}
		let { px: a, py: o } = this.at(e);
		this.inPlot(a, o) && (this.setUi({ probe: Z(this.g.tx(a)) }), this.drag = { k: "probe" }, i.setPointerCapture(e.pointerId));
	}
	onMove(e) {
		let t = this.settings, { px: n, py: r } = this.at(e), i = this.g, a = this.drag;
		if (!a) {
			let t = this.inPlot(n, r) && e.pointerType === "mouse" ? Z(i.tx(n)) : null;
			t !== this.hover && (this.hover = t);
		} else if (a.k === "probe") {
			let e = Z(i.tx(n));
			e !== this.ui?.probe && this.setUi({ probe: e });
		} else if (a.k === "p") {
			let e = a.i, n = jt(i.fy(r) - t.curve.shift);
			n !== t.curve.points[e][1] && this.edit({
				...t,
				curve: Mt(t.curve, e, n)
			});
		} else {
			let e = vt(t.zones.bounds, a.i, Mn(n, i));
			e[a.i] !== t.zones.bounds[a.i] && this.edit({
				...t,
				zones: {
					...t.zones,
					bounds: e
				}
			});
		}
	}
	endDrag() {
		this.drag = null;
	}
	onKey(e) {
		let t = e.target.closest("[data-drag]");
		if (!t || this.readOnly) return;
		let n = this.settings, r = Number(t.dataset.i);
		if (t.dataset.drag === "p") {
			let t = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
			if (!t) return;
			this.edit({
				...n,
				curve: Nt(n.curve, r, t * (e.shiftKey ? 2 : .5))
			});
		} else {
			let t = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
			if (!t) return;
			this.edit({
				...n,
				zones: {
					...n.zones,
					bounds: vt(n.zones.bounds, r, n.zones.bounds[r] + t)
				}
			});
		}
		e.preventDefault();
	}
	onFocus(e, t) {
		let n = e.target;
		this.focused = t && n.dataset?.drag === "p" ? Number(n.dataset.i) : null;
	}
	grid(e) {
		let { L: t, R: n, T: r, B: i, x: a, y: o, W: s } = e, c = [];
		for (let e = 25; e <= 75; e += 5) c.push(k`<line class="grid-l" x1=${t} x2=${n} y1=${o(e)} y2=${o(e)}></line>`);
		for (let e = 20; e >= -20; e -= 5) c.push(k`<line class=${e === 0 ? "grid-z" : "grid-l"} x1=${a(e)} x2=${a(e)} y1=${r} y2=${i}></line>`);
		for (let e = 30; e <= 70; e += 10) c.push(k`<text class="tick" x=${t - 8} y=${o(e) + 4} text-anchor="end">${e}</text>`);
		let l = s < 480 ? 10 : 5;
		for (let e = 20; e >= -20; e -= l) c.push(k`<text class="tick" x=${a(e)} y=${i + 16} text-anchor="middle">${e > 0 ? `+${e}` : G(e, 0, this.lang)}</text>`);
		return c;
	}
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.g, { W: n, H: r, L: i, R: a, T: o, B: s, x: c, y: l, sy: u, sh: d } = t, f = this.lang, p = e.curve, m = e.zones.bounds, h = [
			20,
			...m,
			-20
		], ee = jn(e, t), te = Nn(t), ne = this.ui?.sel ?? null, g = this.ui?.probe ?? null, _ = this.tOut === null ? null : Q(this.tOut, -20, 20), v = this.drag?.k === "p" ? this.drag.i : this.focused, y = _ === null ? null : c(_);
		return O`<svg
      viewBox="0 0 ${n} ${r}"
      role="img"
      aria-label=${R(f, "chart.aria")}
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerleave=${() => !this.drag && (this.hover = null)}
      @pointerup=${this.endDrag}
      @pointercancel=${this.endDrag}
      @keydown=${this.onKey}
      @focusin=${(e) => this.onFocus(e, !0)}
      @focusout=${(e) => this.onFocus(e, !1)}
    >
      ${[
			0,
			1,
			2,
			3
		].map((e) => {
			let t = c(h[e]);
			return k`<rect class="band-${gt[e]}" x=${t} y=${o} width=${c(h[e + 1]) - t} height=${s - o}></rect>`;
		})}
      ${this.grid(t)}
      <text class="axis-t" x=${i} y=${o - 14}>${R(f, "chart.flow_axis")}</text>
      <text class="axis-t" x=${a} y=${o - 14} text-anchor="end">
        ${R(f, n < 480 ? "chart.out_axis_short" : "chart.out_axis")}
      </text>
      <line class="clamp" x1=${i} x2=${a} y1=${l(p.flow_min)} y2=${l(p.flow_min)}></line>
      <text class="clamp-t" x=${i + 4} y=${l(p.flow_min) + 13}>${R(f, "chart.min", { t: G(p.flow_min, 0, f) })}</text>
      <line class="clamp" x1=${i} x2=${a} y1=${l(p.flow_max)} y2=${l(p.flow_max)}></line>
      <text class="clamp-t" x=${a - 4} y=${l(p.flow_max) - 5} text-anchor="end">
        ${R(f, "chart.max", { t: G(p.flow_max, 0, f) })}
      </text>
      ${m.map((e) => k`<line class="bnd-l" x1=${c(e)} x2=${c(e)} y1=${o} y2=${s}></line>`)}
      <path class="curve" d=${An(e, t)}></path>
      ${ee ? k`<path class="curve-bg" d=${ee}></path>` : j}
      ${this.hover !== null && !this.drag ? k`<line class="hover-l" x1=${c(this.hover)} x2=${c(this.hover)} y1=${o} y2=${s}></line>
            <text class="hover-t" x=${Q(c(this.hover) + 6, i, a - 70)} y=${s - 8}>
              ${K(this.hover, f)} → ${Math.round(this.flow(this.hover))}°
            </text>` : j}
      ${y !== null && _ !== null ? k`<line class="now-l" x1=${y} x2=${y} y1=${o} y2=${s}></line>
            <text class="now-t" x=${Q(y, i + 40, a - 40)} y=${o - 2} text-anchor="middle">
              ${R(f, "chart.now", { t: K(this.tOut, f) })}
            </text>` : j}
      ${g === null ? j : k`<line class="probe-l" x1=${c(g)} x2=${c(g)} y1=${o} y2=${s}></line>
            <circle class="probe-d" cx=${c(g)} cy=${l(this.flow(g))} r="4"></circle>
            <text class="probe-t" x=${Q(c(g), i + 54, a - 54)}
              y=${y !== null && Math.abs(c(g) - y) < 90 ? o + 14 : o - 2} text-anchor="middle"
            >${K(g, f)} → ${Math.round(this.flow(g))}°</text>`}
      ${p.points.map(([e], n) => {
			let r = this.flow(e), s = c(e), u = l(r), d = n;
			return k`<circle class="pt-hit" data-k="p${n}" data-drag="p" data-i=${n}
            tabindex=${this.readOnly ? -1 : 0} role="slider"
            aria-label=${R(f, "chart.point", { t: K(e, f) })}
            aria-valuemin="15" aria-valuemax="85" aria-valuenow=${r} aria-valuetext=${mt(r, f)}
            aria-readonly=${this.readOnly ? "true" : "false"}
            cx=${s} cy=${u} r=${te}></circle>
          <circle class="pt ${v === d ? "active" : ""}" cx=${s} cy=${u} r="6.5" pointer-events="none"></circle>
          ${Pn(d, t, v) ? k`<text class="pt-label" x=${Q(s, i + 14, a - 14)} y=${u - 12 < o + 4 ? u + 22 : u - 12}
                text-anchor="middle">${mt(r, f)}</text>` : j}`;
		})}
      ${[
			0,
			1,
			2,
			3
		].map((e) => {
			let t = c(h[e]), n = c(h[e + 1]) - t, r = Dt(Y(e, f), n), i = () => this.setUi({ sel: e });
			return k`<rect class="strip strip-${gt[e]}" data-zone=${e} x=${t + 1} y=${u}
            width=${Math.max(0, n - 2)} height=${d} rx="7" stroke-width=${ne === e ? 2 : 0}
            tabindex="0" role="button" aria-pressed=${String(ne === e)}
            aria-label=${`${Y(e, f)} · ${bt(e, m, f)}`}
            @keydown=${(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), i())}></rect>
          ${r ? k`<text class="strip-t" x=${t + n / 2} y=${u + d / 2 + 4} text-anchor="middle">${r}</text>` : j}`;
		})}
      ${m.map((e, t) => {
			let n = c(e), r = {
				a: Y(t, f),
				b: Y(t + 1, f)
			};
			return k`<rect class="grip-hit" data-k="b${t}" data-drag="b" data-i=${t}
            tabindex=${this.readOnly ? -1 : 0} role="slider" aria-label=${R(f, "chart.bound", r)}
            aria-valuemin="-19" aria-valuemax="19" aria-valuenow=${e} aria-valuetext=${K(e, f)}
            aria-readonly=${this.readOnly ? "true" : "false"}
            x=${n - 16} y=${u - 6} width="32" height=${d + 12}></rect>
          <rect class="grip" x=${n - 6} y=${u - 4} width="12" height=${d + 8} rx="4" pointer-events="none"></rect>
          <line class="grip-line" x1=${n - 2} x2=${n - 2} y1=${u + 10} y2=${u + d - 10}></line>
          <line class="grip-line" x1=${n + 2} x2=${n + 2} y1=${u + 10} y2=${u + d - 10}></line>
          <text class="bnd-t" x=${Q(n, i + 12, a - 12)} y=${u + d + 20} text-anchor="middle">${K(e, f)}</text>`;
		})}
    </svg>`;
	}
}), L("hh-curve-card", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		tOut: { attribute: !1 },
		ui: { attribute: !1 },
		readOnly: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.tOut = null, this.ui = null, this.readOnly = !1;
	}
	static styles = [V, o`
      .hint {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .hint i {
        font-style: normal;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .sw {
        display: inline-block;
        width: 18px;
        height: 0;
        border-top: 3px solid var(--heat);
        border-radius: 2px;
      }
      .sw.now {
        border-top: 2px dashed var(--cold);
      }
      .sw.bg {
        border-top: 2px dashed var(--heat);
        opacity: 0.75;
      }
      .sw.probe {
        border-top: 1.5px solid var(--ink);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        align-items: center;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      input[type='range'] {
        accent-color: var(--heat);
        width: 180px;
        max-width: 100%;
      }
    `];
	edit(e) {
		I(this, "hh-edit", { next: e });
	}
	stepper(e, t, n) {
		return X(this, this.settings, e, t, n, this.readOnly);
	}
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.lang, n = e.curve;
		return this.ui?.sel, O`<section class="card" aria-labelledby="h-curve">
      <div class="card-head">
        <h2 id="h-curve">${R(t, "section.curve")}</h2>
        <hh-hint .lang=${t} .text=${R(t, "curve.note", { limit: G(e.boiler.corr_limit, 0, t) })}></hh-hint>
      </div>
      <div class="hint">
        <i><span class="sw"></span>${R(t, "curve.legend.curve")}</i>
        ${e.hybrid ? O`<i><span class="sw bg"></span>${R(t, "curve.legend.bg")}</i>` : j}
        <i><span class="sw now"></span>${R(t, "curve.legend.now")}</i>
        <i><span class="sw probe"></span>${R(t, "curve.legend.probe")}</i>
      </div>
      <hh-curve-chart
        .lang=${t}
        .settings=${e}
        .tOut=${this.tOut}
        .ui=${this.ui}
        .readOnly=${this.readOnly}
      ></hh-curve-chart>
      <p class="note">${R(t, "zones.note")}</p>
      <div class="controls">
        <div class="field">
          <label for="shift">${R(t, "curve.shift")}</label>
          <div class="range-row">
            <input
              type="range"
              id="shift"
              min="-10"
              max="10"
              step="1"
              .value=${String(n.shift)}
              ?disabled=${this.readOnly}
              @input=${(t) => this.edit(En(e, Number(t.target.value)))}
            />
            <span class="num">${n.shift > 0 ? "+" : ""}${G(n.shift, 0, t)}°</span>
          </div>
        </div>
        ${this.stepper("curve.flow_min", R(t, "curve.flow_min"), `${G(Cn(e, "curve.flow_min"), 0, t)}°`)}
        ${this.stepper("curve.flow_max", R(t, "curve.flow_max"), `${G(Cn(e, "curve.flow_max"), 0, t)}°`)}
        <div class="field">
          <span class="lbl">${R(t, "curve.mode")}</span>
          <hh-seg
            .label=${R(t, "curve.mode")}
            .options=${["smooth", "classic"].map((e) => ({
			value: e,
			label: R(t, `mode.${e}`)
		}))}
            .value=${e.boiler.mode}
            .disabled=${this.readOnly}
            @hh-select=${(t) => this.edit({
			...e,
			boiler: {
				...e.boiler,
				mode: t.detail.value
			}
		})}
          ></hh-seg>
        </div>
        <div id="bg-field" ?hidden=${!e.hybrid}>
          ${this.stepper("curve.ac_background_shift", R(t, "curve.bg"), `−${G(n.ac_background_shift, 0, t)}°`)}
        </div>
      </div>
    </section>`;
	}
});
// src/logic/plan-render.ts
var Fn = (e, t, n) => Math.min(n, Math.max(t, e)), In = (e) => Math.round(e * 10) / 10;
function $(e) {
	return e.map(([e, t]) => `${e},${t}`).join(" ");
}
function Ln(e) {
	if (e === null || !Number.isFinite(e)) return {
		tone: null,
		opacity: 0
	};
	let t = e >= 0 ? Fn(.1 + e * .18, .1, .45) : Fn(.12 - e * .3, .12, .55);
	return {
		tone: e >= 0 ? "heat" : "cold",
		opacity: Math.round(t * 100) / 100
	};
}
function Rn(e) {
	let t = e.from, n = e.to - e.from;
	return [
		-300,
		0,
		300
	].map((r) => {
		let i = e.cx + r;
		return `M${i} ${In(t + Math.sign(n) * 60)} C${i - 220} ${In(t + n * .4)} ${i + 220} ${In(t + n * .75)} ${i} ${e.to}`;
	});
}
function zn(e, t = 160) {
	return {
		x: e.x - t,
		y: e.y - t,
		w: e.w + 2 * t,
		h: e.h + 2 * t
	};
}
function Bn(e) {
	return {
		acOn: Object.fromEntries(z.map((t) => [t, !!e && e.acs[t].available && e.acs[t].hvac === "heat"])),
		heatOn: !!e && e.boiler.call_on === !0
	};
}
L("hh-floor-plan", class extends F {
	static properties = {
		lang: {},
		plan: { attribute: !1 },
		schematic: { type: Boolean },
		status: { attribute: !1 },
		offsets: { attribute: !1 },
		settings: { attribute: !1 },
		learning: { type: Boolean },
		picked: { state: !0 },
		focused: { state: !0 }
	};
	constructor() {
		super(), this.lang = "en", this.plan = null, this.schematic = !1, this.status = null, this.offsets = {}, this.settings = null, this.learning = !1, this.picked = null, this.focused = null;
	}
	static styles = [V, o`
      svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .wall {
        fill: var(--wall);
      }
      .glass {
        fill: var(--cold);
        opacity: 0.35;
      }
      .bay {
        fill: none;
        stroke: var(--cold);
        stroke-width: 70;
        opacity: 0.55;
        stroke-linejoin: round;
      }
      .neutral {
        fill: var(--line);
        fill-opacity: 0.45;
      }
      .room {
        transition: fill-opacity 0.4s;
        cursor: pointer;
      }
      .room:focus {
        outline: none;
      }
      /* Twice as wide as it shows: clipped to the room, so the walls on its edges do not hide it. */
      .ring {
        fill: none;
        stroke: var(--cold);
        stroke-width: 240;
        pointer-events: none;
      }
      .room-n,
      .room-t,
      .fh,
      .rad,
      .rad-glow,
      .ac-flow,
      .neutral {
        pointer-events: none;
      }
      .room-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .rc-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .rc-head .close {
        margin-left: auto;
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }
      .fb {
        display: flex;
        gap: 6px;
      }
      .room-n {
        fill: var(--muted);
        font-size: 270px;
        font-family: var(--font-body);
      }
      .small-n {
        font-size: 230px;
      }
      .room-t {
        fill: var(--ink);
        font-size: 520px;
        font-family: var(--font-data);
        font-weight: 500;
      }
      .ac-unit {
        fill: var(--surface);
        stroke: var(--line-strong);
        stroke-width: 40;
      }
      .ac-unit.on {
        stroke: var(--ac);
        stroke-width: 60;
      }
      .ac-flow {
        fill: none;
        stroke: var(--ac);
        stroke-width: 55;
        stroke-linecap: round;
        stroke-dasharray: 170 230;
        opacity: 0;
      }
      .ac-flow.on {
        opacity: 0.9;
        animation: flow 1.4s linear infinite;
      }
      .rad {
        fill: var(--line-strong);
        transition: fill 0.3s;
      }
      .rad.on {
        fill: var(--heat);
      }
      .rad-glow {
        fill: var(--heat);
        opacity: 0;
      }
      .rad-glow.on {
        animation: glow 2.4s ease-in-out infinite;
      }
      .fh {
        fill: url(#fh);
        opacity: 0.12;
        transition: opacity 0.4s;
      }
      .fh.on {
        opacity: 0.45;
      }
      .fh-line {
        stroke: var(--heat);
        stroke-width: 45;
      }
      @keyframes flow {
        to {
          stroke-dashoffset: -400;
        }
      }
      @keyframes glow {
        0%,
        100% {
          opacity: 0.12;
        }
        50% {
          opacity: 0.32;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ac-flow.on,
        .rad-glow.on {
          animation: none;
        }
        .rad-glow.on {
          opacity: 0.22;
        }
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .legend i {
        font-style: normal;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend b {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }
    `];
	rect(e, t, n = 0) {
		return k`<rect class=${t} x=${e.x} y=${e.y} width=${e.w} height=${e.h} rx=${n}></rect>`;
	}
	ac(e, t) {
		let n = t ? " on" : "";
		return k`${Rn(e).map((e) => k`<path class=${`ac-flow${n}`} d=${e}></path>`)}
      ${this.rect(e, `ac-unit${n}`, 60)}`;
	}
	ring(e, t) {
		return e.rooms[t].polygons.map((e, n) => {
			let r = `ring-${t}-${n}`;
			return k`<clipPath id=${r}><polygon points=${$(e)}></polygon></clipPath>
        <polygon class="ring" data-room=${t} points=${$(e)} clip-path=${`url(#${r})`}></polygon>`;
		});
	}
	offset(e) {
		return this.settings?.room_offsets[e] ?? this.offsets[e] ?? 0;
	}
	roomCard(e) {
		let t = this.picked, n = this.status;
		if (!t || !n) return j;
		let r = this.lang, i = n.rooms[t], a = n.target + this.offset(t), o = t === "living" || t === "bedroom" ? this.acLine(t) : null, s = R(r, t === "bath" ? e ? "room.floor_on" : "room.floor_off" : e ? "room.rads_on" : "room.rads_off"), c = (e) => I(this, "hh-action", {
			kind: "feedback",
			room: t,
			value: e
		});
		return O`<div class="room-card" role="region" aria-label=${R(r, `room.${t}`)}>
      <div class="rc-head">
        <b>${R(r, `room.${t}`)}</b>
        <span class="num">${i === null ? "—" : `${G(i, 1, r)}°`}</span>
        <span class="muted small">
          ${R(r, "room.target", { t: G(a, 1, r) })}${i === null ? "" : ` (${ht(i - a, r)})`}
        </span>
        <button class="close" type="button" aria-label=${R(r, "close")} @click=${() => this.picked = null}>×</button>
      </div>
      <p class="small">${s}</p>
      ${o ? O`<p class="small">${o}</p>` : j}
      ${this.learning ? O`<div class="fb">
            <button class="btn sm" type="button" @click=${() => c("cold")}>${R(r, "feedback.cold")}</button>
            <button class="btn sm" type="button" @click=${() => c("hot")}>${R(r, "feedback.hot")}</button>
          </div>` : j}
    </div>`;
	}
	acLine(e) {
		let t = this.lang, n = this.status.acs[e];
		if (!n.available) return R(t, "room.ac_unavailable");
		if (!n.hvac || n.hvac === "off") return R(t, "room.ac_off");
		let r = n.setpoint === null ? "—" : G(n.setpoint, 0, t);
		return n.hvac === "heat" && this.settings?.layers.ac === "active" && n.owned ? R(t, "room.ac_module", { sp: r }) : n.hvac === "heat" ? R(t, "room.ac_hand", { sp: r }) : R(t, "room.ac_mode", { mode: n.hvac });
	}
	render() {
		let e = this.plan, t = this.status, n = this.lang;
		if (!e) return null;
		let { acOn: r, heatOn: i } = Bn(t), a = i ? " on" : "";
		return O`<section class="card" aria-labelledby="h-plan">
      <div class="card-head">
        <h2 id="h-plan">${R(n, "section.plan")}</h2>
        <hh-hint .lang=${n} .text=${R(n, "plan.note") + (this.schematic ? ` ${R(n, "plan.schematic")}` : "")}></hh-hint>
      </div>
      <svg viewBox=${e.viewBox.join(" ")} role="group" aria-label=${R(n, "plan.aria")}>
        <defs>
          <pattern id="fh" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line class="fh-line" x1="0" y1="0" x2="0" y2="260"></line>
          </pattern>
        </defs>
        ${e.neutral.map((e) => k`<polygon class="neutral" points=${$(e)}></polygon>`)}
        ${Ue.map((r) => {
			let i = t?.rooms[r] ?? null, a = Ln(i === null || !t ? null : i - (t.target + this.offset(r))), o = a.tone ? `var(--${a.tone})` : "transparent", s = () => this.picked = this.picked === r ? null : r;
			return e.rooms[r].polygons.map((e) => k`<polygon class="room" data-room=${r}
              points=${$(e)} fill=${o} fill-opacity=${a.opacity}
              tabindex="0" role="button" aria-label=${R(n, `room.${r}`)} aria-pressed=${String(this.picked === r)}
              @click=${s}
              @focus=${() => this.focused = r}
              @blur=${() => this.focused = null}
              @keydown=${(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), s())}
            ></polygon>`);
		})}
        ${e.floor_heating.map((e) => this.rect(e, `fh${a}`))}
        ${e.radiators.map((e) => k`${this.rect(zn(e), `rad-glow${a}`, 120)}${this.rect(e, `rad${a}`, 30)}`)}
        ${e.glass.map((e) => this.rect(e, "glass"))}
        ${e.bays.map((e) => k`<polyline class="bay" points=${$(e)}></polyline>`)}
        ${e.walls.map((e) => k`<polygon class="wall" points=${$(e)}></polygon>`)}
        ${Object.entries(e.acs).map(([e, t]) => this.ac(t, r[e]))}
        ${[.../* @__PURE__ */ new Set([this.picked, this.focused])].map((t) => t ? this.ring(e, t) : j)}
        ${Ue.map((r) => {
			let [i, a] = e.rooms[r].label, o = t?.rooms[r] ?? null;
			return k`<text class="room-n" x=${i} y=${a - 560} text-anchor="middle">${R(n, `room.${r}`)}</text>
            <text class="room-t" x=${i} y=${a} text-anchor="middle">${o === null ? "—" : `${G(o, 1, n)}°`}</text>`;
		})}
        ${e.small_labels.map((e) => k`<text class="room-n small-n" x=${e.at[0]} y=${e.at[1]} text-anchor="middle">${R(n, `place.${e.key}`)}</text>`)}
      </svg>
      ${this.roomCard(i)}
      <div class="legend">
        <i><b style="background:var(--cold);opacity:.5"></b>${R(n, "legend.cold")}</i>
        <i><b style="background:var(--heat);opacity:.45"></b>${R(n, "legend.heat")}</i>
        <i><b style="background:var(--ac)"></b>${R(n, "legend.ac")}</i>
        <i><b style="background:var(--heat)"></b>${R(n, "legend.rad")}</i>
      </div>
    </section>`;
	}
}), L("hh-forecast", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		model: { attribute: !1 },
		forecast: { attribute: !1 },
		fsel: { attribute: !1 },
		tz: {}
	};
	size = new Dn(this);
	constructor() {
		super(), this.lang = "en", this.settings = null, this.model = null, this.forecast = void 0, this.fsel = null, this.tz = "UTC";
	}
	static styles = [V, o`
      svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .fc-bar {
        cursor: pointer;
      }
      .band-ac {
        fill: var(--ac-fill);
      }
      .band-mix {
        fill: var(--mix-fill);
      }
      .band-heat {
        fill: var(--heat-fill);
      }
      .band-deep {
        fill: var(--deep-fill);
      }
      .fc-line {
        fill: none;
        stroke: var(--ink);
        stroke-width: 2;
      }
      .fc-sel {
        fill: none;
        stroke: var(--ink);
        stroke-width: 1.5;
      }
      .fc-t {
        fill: var(--muted);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .fc-day {
        fill: var(--ink);
        font-size: 11.5px;
        font-weight: 600;
      }
      .fc-zero {
        stroke: var(--line-strong);
        stroke-dasharray: 3 3;
      }
      .fc-sum {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 24px;
        align-items: baseline;
      }
      .big {
        font-weight: 500;
        font-size: 22px;
        font-variant-numeric: tabular-nums;
      }
    `];
	strip() {
		let e = this.settings, t = this.forecast.hours, n = this.lang, r = Math.max(300, this.size.width || 640), i = r - 8, a = (i - 30) / t.length, { tmin: o, tmax: s, ticks: c } = Kt(t.map((e) => e.t_out)), l = (e) => 116 - (e - o) / (s - o) * 102, u = r < 520 ? 12 : 6, d = this.fsel !== null && this.fsel < t.length ? this.fsel : null, f = t.map((e, t) => `${t ? "L" : "M"}${(30 + t * a + a / 2).toFixed(1)} ${l(e.t_out).toFixed(1)}`).join(" ");
		return O`<svg viewBox="0 0 ${r} ${170}" role="img" aria-label=${R(n, "forecast.aria")}>
      ${t.map((t, n) => k`<rect class="fc-bar band-${gt[_t(e.zones.bounds, t.t_out)]}" data-h=${n}
          x=${30 + n * a} y=${14} width=${a + .5} height=${102}
          @click=${() => I(this, "hh-ui", {
			fsel: n,
			probe: t.t_out
		})}></rect>`)}
      ${o < 0 && s > 0 ? k`<line class="fc-zero" x1=${30} x2=${i} y1=${l(0)} y2=${l(0)}></line>` : j}
      ${c.map((e) => k`<text class="fc-t" x=${24} y=${l(e) + 4} text-anchor="end">${e > 0 ? `+${e}` : G(e, 0, n)}</text>`)}
      <path class="fc-line" d=${f}></path>
      ${d === null ? j : k`<rect class="fc-sel" x=${30 + d * a} y=${14} width=${a} height=${102}></rect>
            <circle cx=${30 + d * a + a / 2} cy=${l(t[d].t_out)} r="4" fill="var(--ink)"></circle>`}
      ${t.map((e, t) => {
			let r = W(e.ts, this.tz), i = 30 + t * a;
			return k`${r.hour % u === 0 || t === 0 ? k`<text class="fc-t" x=${i + a / 2} y=${132} text-anchor="middle">${r.hhmm}</text>` : j}${r.hour === 0 || t === 0 ? k`<text class="fc-day" x=${i + 2} y=${152}>${ft(e.ts, this.tz, n)}</text>` : j}`;
		})}
    </svg>`;
	}
	body() {
		let e = this.lang, t = this.forecast;
		return t === void 0 ? O`<p class="note">…</p>` : t === null ? O`<p class="note">${R(e, "stage5.forecast")}</p>` : t.hours.length ? O`${this.strip()}
      <p class="small">${qt(this.settings, t.hours, this.tz, e)}</p>` : O`<p class="note">${R(e, "forecast.empty")}</p>`;
	}
	totals() {
		let e = this.forecast, t = this.model;
		if (!e?.hours.length || !t) return j;
		let n = this.lang, r = Gt(this.settings, t, e.hours, this.tz);
		return O`<div class="fc-sum">
      <span><span class="big">${G(r.kwh, 0, n)}</span> <span class="muted">${R(n, "unit.kwh")}</span></span>
      <span>
        <span class="big">${G(r.cost, 0, n)}</span>
        <span class="muted">${R(n, "forecast.per48", { currency: t.currency })}</span>
      </span>
      <span class="muted small">
        ${R(n, "forecast.boiler_only", { cost: `${G(r.boilerOnlyCost, 0, n)} ${t.currency}` })}
      </span>
    </div>`;
	}
	render() {
		if (!this.settings) return j;
		let e = this.lang;
		return O`<section class="card" aria-labelledby="h-fc">
      <div class="head-row">
        <div class="card-head">
          <h2 id="h-fc">${R(e, "section.forecast")}</h2>
          <hh-hint .lang=${e} .text=${R(e, "forecast.note")}></hh-hint>
        </div>
        ${this.totals()}
      </div>
      ${this.body()}
    </section>`;
	}
}), L("hh-footer", class extends F {
	static properties = {
		lang: {},
		dirty: { type: Boolean },
		saving: { type: Boolean },
		admin: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.dirty = !1, this.saving = !1, this.admin = !1;
	}
	static styles = [V, o`
      :host {
        position: sticky;
        bottom: 12px;
        z-index: 3;
        display: block;
      }
      .foot {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-radius: var(--r);
        padding: 10px 14px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
      }
      @media (prefers-reduced-motion: no-preference) {
        .foot {
          animation: up 0.18s ease-out;
        }
        @keyframes up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
        }
      }
      .btns {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `];
	act(e) {
		I(this, "hh-action", e);
	}
	render() {
		let e = this.lang;
		return !this.admin || !this.dirty ? null : O`<footer class="foot">
      <p class="small" role="status">${R(e, "dirty")}</p>
      <div class="btns">
        <button class="btn" type="button" ?disabled=${this.saving} @click=${() => this.act({ kind: "discard" })}>
          ${R(e, "discard")}
        </button>
        <button class="btn primary" type="button" ?disabled=${this.saving} @click=${() => this.act({ kind: "save" })}>
          ${R(e, "save")}
        </button>
      </div>
    </footer>`;
	}
}), L("hh-switch", class extends F {
	static properties = {
		checked: { type: Boolean },
		label: {},
		disabled: { type: Boolean }
	};
	constructor() {
		super(), this.checked = !1, this.label = "", this.disabled = !1;
	}
	static styles = [V, o`
      :host {
        display: inline-flex;
      }
      .switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        background: var(--surface);
        border-radius: 999px;
        padding: 5px 12px 5px 6px;
        font: inherit;
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
      }
      .switch:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .knob {
        width: 34px;
        height: 20px;
        border-radius: 999px;
        background: var(--line-strong);
        position: relative;
        flex: none;
        transition: background 0.15s;
      }
      .knob::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--surface);
        transition: transform 0.15s;
      }
      .switch[aria-checked='true'] .knob {
        background: var(--ac);
      }
      .switch[aria-checked='true'] .knob::after {
        transform: translateX(14px);
      }
    `];
	render() {
		return O`<button
      class="switch"
      type="button"
      role="switch"
      aria-checked=${String(this.checked)}
      ?disabled=${this.disabled}
      @click=${() => I(this, "hh-toggle", { checked: !this.checked })}
    >
      <span class="knob"></span>${this.label}
    </button>`;
	}
}), L("hh-header", class extends F {
	static properties = {
		lang: {},
		heading: {},
		version: {},
		settings: { attribute: !1 },
		status: { attribute: !1 },
		note: {}
	};
	constructor() {
		super(), this.lang = "en", this.heading = "", this.version = "", this.settings = null, this.status = null, this.note = "";
	}
	static styles = [V, o`
      :host {
        display: block;
        container-type: inline-size;
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px 24px;
      }
      .title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        max-width: 560px;
      }
      .status {
        align-self: flex-start;
        font-size: 13px;
        font-weight: 500;
        border-radius: 999px;
        padding: 3px 10px;
        color: var(--muted);
        background: var(--bg);
        border: 1px solid var(--line);
      }
      .status.warn {
        color: var(--warn-ink);
        background: var(--warn-bg);
        border-color: transparent;
      }
      .status.ok {
        color: var(--ok);
        border-color: var(--ok);
        background: transparent;
      }
      .top-ctl {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .preset {
        font: inherit;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 92px;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
        text-align: left;
      }
      .pt-n {
        font-weight: 600;
        font-size: 13px;
      }
      .pt-v {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--muted);
      }
      .preset[aria-pressed='true'] {
        background: var(--ink);
        color: var(--surface);
        border-color: var(--ink);
      }
      .preset[aria-pressed='true'] .pt-v {
        color: inherit;
        opacity: 0.75;
      }
      /* phones: the four presets in one row */
      @container (max-width: 560px) {
        .top-ctl,
        .presets {
          width: 100%;
        }
        .presets {
          flex-wrap: nowrap;
        }
        .preset {
          flex: 1 1 0;
          min-width: 0;
          padding: 6px 8px;
        }
      }
    `];
	act(e) {
		I(this, "hh-action", e);
	}
	render() {
		let e = this.settings, t = this.lang;
		return O`<header class="top">
      <div class="title">
        <h1>${this.heading || R(t, "title")}</h1>
        ${this.status ? O`<p class="status ${this.status.tone}" role="status">${this.status.text}</p>` : null}
        ${this.note ? O`<p class="small muted">${this.note}</p>` : null}
      </div>
      ${e ? O`<div class="top-ctl">
            <div class="presets" role="group" aria-label=${R(t, "preset.group")}>
              ${Ge.map((n) => O`<button
                  type="button"
                  class="preset"
                  aria-pressed=${String(e.preset === n)}
                  @click=${() => e.preset !== n && this.act({
			kind: "preset",
			preset: n
		})}
                >
                  <span class="pt-n">${R(t, `preset.${n}`)}</span>
                  <span class="pt-v">${G(e.targets[n], 1, t)}°</span>
                </button>`)}
            </div>
            <hh-switch
              .checked=${e.hybrid}
              .label=${R(t, "hybrid")}
              @hh-toggle=${(e) => this.act({
			kind: "hybrid",
			on: e.detail.checked
		})}
            ></hh-switch>
          </div>` : null}
    </header>`;
	}
});
// src/logic/panels.ts
function Vn(e, t, n = 10) {
	let r = (e) => Math.round(Math.min(100, Math.max(0, e / n * 100)) * 10) / 10;
	return {
		fill: e === null ? 0 : r(e),
		hi: e !== null && t - e < 2,
		mark: r(t)
	};
}
function Hn(e, t, n) {
	let r = e.t_out_window_mean;
	return R(n, e.season_active ? "season.on" : "season.off", {
		hours: t.season.window_hours,
		t: r === null ? "—" : `${ht(r, n)}°`
	});
}
function Un(e, t, n) {
	let r = e.load;
	if (!r.shedding) return null;
	let i = [];
	return r.water_heater_shed && i.push(R(n, "why.water_heater")), r.rods_shed > 0 && i.push(R(n, "load.shed_rods", { n: r.rods_shed })), i.length || i.push(R(n, "why.boiler_paused_word")), R(n, t.layers.load === "active" ? "load.shedding_now" : "load.shedding_obs", { what: i.join(", ") });
}
function Wn(e, t) {
	let n = e?.attributes?.temperature;
	return !e || e.state === "off" || typeof n != "number" ? null : Math.abs(n - t) >= .5 ? {
		thermostat: n,
		target: t
	} : null;
}
// src/sections/hh-load.ts
var Gn = 10;
L("hh-load", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		status: { attribute: !1 },
		readOnly: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.status = null, this.readOnly = !1;
	}
	static styles = [V, o`
      ol.shed {
        margin: 0;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .meter {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .bar {
        height: 12px;
        border-radius: 999px;
        background: var(--bg);
        border: 1px solid var(--line);
        position: relative;
        overflow: hidden;
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--ac);
        transition: width 0.4s;
      }
      .fill.hi {
        background: var(--mix);
      }
      .mark {
        position: absolute;
        top: -1px;
        bottom: -1px;
        width: 2px;
        background: var(--ink);
      }
    `];
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.lang, n = this.status?.load.kw ?? null, r = e.load.limit_kw, i = Vn(n, r, Gn), a = this.status ? Un(this.status, e, t) : null;
		return O`<section class="card" aria-labelledby="h-load">
      <div class="card-head">
        <h2 id="h-load">${R(t, "section.load")}</h2>
        <hh-hint .lang=${t} .text=${R(t, "load.note")}></hh-hint>
      </div>
      <div class="pair">
        ${X(this, e, "load.limit_kw", R(t, "load.limit"), q(r, t), this.readOnly)}
        ${X(this, e, "load.restore_kw", R(t, "load.restore"), q(e.load.restore_kw, t), this.readOnly)}
      </div>
      <div class="field">
        <span class="lbl">${R(t, "load.queue")}</span>
        <ol class="shed">
          <li>${R(t, "load.q1", {
			s: e.load.shed_after_s,
			p: e.load.pause_s
		})}</li>
          <li>${R(t, "load.q2", { step: e.load.step_interval_s })}</li>
          <li>
            ${R(t, "load.q3", {
			restore: q(e.load.restore_kw, t),
			min: Math.round(e.load.restore_after_s / 60)
		})}
          </li>
        </ol>
      </div>
      ${a ? O`<p class="warn">${a}</p>` : j}
      <div class="meter">
        <div class="bar">
          <span class="fill ${i.hi ? "hi" : ""}" style="width:${i.fill}%"></span>
          <span class="mark" style="left:${i.mark}%"></span>
        </div>
        <span class="small muted">
          ${n === null ? R(t, "load.now_unknown") : R(t, "load.now", {
			kw: q(n, t),
			limit: q(r, t),
			scale: Gn
		})}
        </span>
      </div>
    </section>`;
	}
});
// src/logic/log.ts
var Kn = {};
for (let [e, t] of [
	["heat", [
		"smooth_on",
		"smooth_resumed",
		"classic_on_avg",
		"classic_on_coldest",
		"feedback_hot"
	]],
	["idle", [
		"smooth_paused",
		"smooth_overheat_wait",
		"classic_off",
		"ac_stopped",
		"ac_manual_left_alone",
		"ac_manual_off",
		"ac_manual_hold",
		"season_idle",
		"zone_boiler_off"
	]],
	["cold", [
		"shed_water_heater",
		"shed_rod",
		"pause_boiler",
		"rods_budget_exhausted",
		"outdoor_unavailable",
		"rooms_unavailable",
		"ac_not_coping",
		"ac_unavailable",
		"load_unknown",
		"feedback_cold",
		"tick_failed",
		"failsafe"
	]],
	["ok", [
		"restore_rod",
		"restore_water_heater",
		"season_started",
		"season_ended",
		"settings_changed",
		"suggestion_applied"
	]]
]) for (let n of t) Kn[n] = e;
var qn = {
	ac: "ac",
	boiler: "heat",
	load: "ok"
};
function Jn(e) {
	if (e.actions.some((e) => e.status === "failed")) return "cold";
	let t = e.reasons[0];
	return t ? Kn[t.code] ?? qn[t.layer] ?? "idle" : "idle";
}
function Yn(e, t, n, r) {
	let i = W(e, n), a = r === "en" ? "en-GB" : r, o = new Intl.DateTimeFormat(a, {
		day: "2-digit",
		month: "2-digit",
		timeZone: n
	}).format(new Date(e));
	return {
		short: i.dateKey === W(t, n).dateKey ? i.hhmm : o,
		full: `${o}, ${i.hhmm}`
	};
}
function Xn(e, t = "en") {
	let [n, ...r] = e.reasons, i = r.map((e) => e.text), a = e.actions.filter((e) => e.status === "failed").length, o = e.actions.filter((e) => e.status === "skipped").length;
	return a && i.push(R(t, "log.failed", { n: a })), o && i.push(R(t, "log.skipped", { n: o })), {
		title: n?.text ?? "",
		detail: i.join(" · ")
	};
}
L("hh-log", class extends F {
	static properties = {
		lang: {},
		entries: { attribute: !1 },
		now: {},
		tz: {}
	};
	constructor() {
		super(), this.lang = "en", this.entries = [], this.now = (/* @__PURE__ */ new Date()).toISOString(), this.tz = "UTC";
	}
	static styles = [V, o`
      .log {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      li {
        display: grid;
        grid-template-columns: 44px 10px minmax(0, 1fr);
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
        align-items: start;
      }
      li:last-child {
        border-bottom: 0;
      }
      .tm {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--muted);
        padding-top: 1px;
      }
      .pip {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 5px;
      }
      .pip-ac {
        background: var(--ac);
      }
      .pip-heat {
        background: var(--heat);
      }
      .pip-idle {
        background: var(--line-strong);
      }
      .pip-cold {
        background: var(--cold);
      }
      .pip-ok {
        background: var(--ok);
      }
      .tx b {
        font-weight: 600;
      }
      .tx span {
        display: block;
        font-size: 12.5px;
        color: var(--muted);
      }
    `];
	render() {
		let e = this.lang;
		return O`<section class="card" aria-labelledby="h-log">
      <div class="card-head">
        <h2 id="h-log">${R(e, "section.log")}</h2>
        <hh-hint .lang=${e} .text=${R(e, "log.note")}></hh-hint>
      </div>
      ${this.entries.length ? O`<ul class="log">
            ${this.entries.map((t) => {
			let n = Yn(t.ts, this.now, this.tz, e), { title: r, detail: i } = Xn(t, e);
			return O`<li>
                <span class="tm" title=${n.full}>${n.short}</span><span class="pip pip-${Jn(t)}"></span>
                <span class="tx"><b>${r}</b>${i ? O`<span>${i}</span>` : null}</span>
              </li>`;
		})}
          </ul>` : O`<p class="note">${R(e, "log.empty")}</p>`}
    </section>`;
	}
}), L("hh-probe", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		model: { attribute: !1 },
		probe: { attribute: !1 },
		tOut: { attribute: !1 }
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.model = null, this.probe = 0, this.tOut = null;
	}
	static styles = [V, o`
      input[type='range'] {
        accent-color: var(--heat);
        width: 100%;
      }
      .probe-big {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .probe-big .num {
        font-size: 30px;
        font-weight: 500;
      }
      .linkbtn {
        font: inherit;
        font-size: 12.5px;
        border: 1px solid var(--line);
        background: transparent;
        color: var(--ink);
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
      }
      .linkbtn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .stack {
        display: flex;
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--bg);
        border: 1px solid var(--line);
      }
      .stack i {
        display: block;
        height: 100%;
      }
      .s-ac {
        background: var(--ac);
      }
      .s-b {
        background: var(--heat);
      }
      .s-short {
        background: repeating-linear-gradient(45deg, var(--deep) 0 4px, transparent 4px 8px);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .legend i {
        font-style: normal;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend b {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }
      .readout {
        display: flex;
        flex-direction: column;
      }
      .r {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 0;
        border-bottom: 1px solid var(--line);
      }
      .r:last-child {
        border-bottom: 0;
      }
      .r span:last-child {
        font-family: var(--font-data);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
    `];
	render() {
		let e = this.settings, t = this.model;
		if (!e || !t) return j;
		let n = this.lang, r = this.probe, i = Ut(e, t, r, { night: e.preset === "night" }), a = Wt(i, t), o = e.zones.policies[i.zone], s = Math.max(i.demandKw, .001), c = (e) => `${e / s * 100}%`, l = [
			[R(n, "probe.flow"), `${Math.round(i.flow)}°${i.background && e.curve.ac_background_shift ? R(n, "probe.flow_bg") : ""}`],
			[R(n, "probe.demand"), q(i.demandKw, n)],
			...z.map((e) => [R(n, `probe.ac_${e}`), i.acKw[e] > 0 ? q(i.acKw[e], n) : R(n, "probe.off")]),
			[R(n, "probe.cop"), i.cop ? `×${G(i.cop, 1, n)}` : "—"],
			[R(n, "probe.boiler"), o.boiler === "off" ? R(n, "probe.boiler_off") : R(n, "probe.boiler_of", {
				kw: G(i.boilerKw, 1, n),
				cap: q(i.boilerCapKw, n)
			})],
			[R(n, "probe.kwh"), `${G(a.kwh, 0, n)} ${R(n, "unit.kwh")}`],
			[R(n, "probe.cost"), `${G(a.cost, 0, n)} ${t.currency}`],
			[R(n, "probe.saving"), a.saving > .005 ? `−${G(a.saving * 100, 0, n)}%` : R(n, "probe.same")]
		];
		return O`<section class="card" aria-labelledby="h-probe">
      <div class="card-head">
        <h2 id="h-probe">${R(n, "section.probe")}</h2>
        <hh-hint .lang=${n} .text=${R(n, "probe.note", { h: G(t.h_w_per_k, 0, n) })}></hh-hint>
      </div>
      <div class="field">
        <label for="probe">${R(n, "probe.out")}</label>
        <input
          type="range"
          id="probe"
          min="-20"
          max="20"
          step="0.5"
          .value=${String(r)}
          @input=${(e) => I(this, "hh-ui", { probe: Z(Number(e.target.value)) })}
        />
      </div>
      <div class="probe-big">
        <span class="num">${K(r, n)}</span>
        <span class="muted">${R(n, "probe.zone", { name: Y(i.zone, n) })}</span>
        <button
          class="linkbtn"
          id="probe-now"
          type="button"
          ?disabled=${this.tOut === null}
          @click=${() => this.tOut !== null && I(this, "hh-ui", {
			probe: this.tOut,
			fsel: null
		})}
        >
          ${R(n, "probe.now")}
        </button>
      </div>
      <div class="stack" aria-hidden="true">
        <i class="s-ac" style="width:${c(i.acTotalKw)}"></i><i class="s-b" style="width:${c(i.boilerKw)}"></i
        ><i class="s-short" style="width:${c(i.shortKw)}"></i>
      </div>
      <div class="legend">
        <i><b style="background:var(--ac)"></b>${R(n, "probe.legend.ac")}</i>
        <i><b style="background:var(--heat)"></b>${R(n, "probe.legend.boiler")}</i>
        <i><b style="background:var(--deep)"></b>${R(n, "probe.legend.short")}</i>
      </div>
      <div class="readout">${l.map(([e, t]) => O`<div class="r"><span>${e}</span><span>${t}</span></div>`)}</div>
      ${i.shortKw > .05 ? O`<p class="warn">${R(n, "probe.short", { kw: q(i.shortKw, n) })}</p>` : j}
    </section>`;
	}
});
// src/sections/hh-rooms.ts
var Zn = [
	"quiet",
	"off",
	"day"
], Qn = (e) => e === "living" || e === "bedroom", $n = (e) => e.slice(0, 5);
L("hh-rooms", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		status: { attribute: !1 },
		learning: { type: Boolean },
		readOnly: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.status = null, this.learning = !1, this.readOnly = !1;
	}
	static styles = [V, o`
      .rooms {
        display: flex;
        flex-direction: column;
      }
      .roomrow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 9px 0;
        border-bottom: 1px solid var(--line);
        align-items: center;
      }
      .roomrow:last-child {
        border-bottom: 0;
      }
      .t {
        font-family: var(--font-data);
        font-variant-numeric: tabular-nums;
      }
      .by {
        font-size: 12.5px;
        color: var(--muted);
      }
      .fb {
        display: flex;
        gap: 6px;
        grid-column: 1/-1;
      }
      .fb button {
        font: inherit;
        font-size: 12px;
        border: 1px solid var(--line);
        background: transparent;
        color: var(--ink);
        border-radius: 999px;
        padding: 3px 10px;
        cursor: pointer;
      }
      .fb button.cold:hover {
        border-color: var(--cold);
        color: var(--cold);
      }
      .fb button.hot:hover {
        border-color: var(--heat);
        color: var(--heat);
      }
      .nightsel {
        grid-column: 1/-1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
      }
    `];
	target(e, t, n) {
		return X(this, this.settings, e, t, `${G(n, 1, this.lang)}°`, this.readOnly);
	}
	row(e) {
		let t = this.settings, n = this.lang, r = this.status?.rooms[e] ?? null, i = this.status?.target ?? null, a = (t) => I(this, "hh-action", {
			kind: "feedback",
			room: e,
			value: t
		});
		return O`<div class="roomrow">
      <span><b>${R(n, `room.${e}`)}</b> <span class="by">· ${R(n, `room_by.${e}`)}</span></span>
      <span class="t"
        >${r === null ? "—" : `${G(r, 1, n)}°`}
        ${r !== null && i !== null ? O`<span class="muted small">${ht(r - (i + (t.room_offsets[e] ?? 0)), n)}</span>` : j}</span
      >
      ${this.learning ? O`<div class="fb">
            <button type="button" class="cold" @click=${() => a("cold")}>${R(n, "feedback.cold")}</button>
            <button type="button" class="hot" @click=${() => a("hot")}>${R(n, "feedback.hot")}</button>
          </div>` : j}
      ${Qn(e) ? O`<div class="nightsel">
            <span class="by">${R(n, "rooms.ac_night")}</span>
            <hh-seg
              small
              .label=${R(n, "rooms.ac_night")}
              .options=${Zn.map((e) => ({
			value: e,
			label: R(n, `night.${e}`)
		}))}
              .value=${t.ac.night[e]}
              .disabled=${this.readOnly}
              @hh-select=${(n) => I(this, "hh-edit", { next: {
			...t,
			ac: {
				...t.ac,
				night: {
					...t.ac.night,
					[e]: n.detail.value
				}
			}
		} })}
            ></hh-seg>
          </div>` : j}
    </div>`;
	}
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.lang, n = e.targets;
		return O`<section class="card" aria-labelledby="h-rooms">
      <div class="card-head">
        <h2 id="h-rooms">${R(t, "section.rooms")}</h2>
        <hh-hint .lang=${t} .text=${R(t, this.learning ? "rooms.note" : "rooms.note_plain")}></hh-hint>
      </div>
      <div class="pair">
        ${this.target("targets.comfort", R(t, "preset.comfort"), n.comfort)}
        ${this.target("targets.night", R(t, "rooms.night", {
			start: $n(n.night_start),
			end: $n(n.night_end)
		}), n.night)}
        ${this.target("targets.eco", R(t, "preset.eco"), n.eco)}
        ${this.target("targets.away", R(t, "preset.away"), n.away)}
      </div>
      ${e.boiler.mode === "classic" ? this.target("boiler.classic_coldest_tolerance", R(t, "rooms.tolerance"), e.boiler.classic_coldest_tolerance) : j}
      <div class="rooms">${Ue.map((e) => this.row(e))}</div>
    </section>`;
	}
});
// src/sections/hh-season.ts
var er = [
	"auto",
	"on",
	"off"
], tr = [
	"off",
	"observe",
	"active"
];
L("hh-season", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		status: { attribute: !1 },
		readOnly: { type: Boolean },
		version: {},
		thermostat: { attribute: !1 },
		savedBoiler: {}
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.status = null, this.readOnly = !1, this.version = "", this.thermostat = void 0, this.savedBoiler = "observe";
	}
	static styles = [V, o`
      .layers {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .layer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px 12px;
      }
    `];
	edit(e) {
		I(this, "hh-edit", { next: e });
	}
	controlWarning() {
		let e = this.status?.target;
		if (this.savedBoiler === "active" || e === void 0) return j;
		let t = Wn(this.thermostat, e);
		if (!t) return j;
		let n = this.lang, r = {
			th: G(t.thermostat, 1, n),
			target: G(t.target, 1, n)
		};
		return O`<p class="warn">${R(n, "thermo.gap", r)}${R(n, "thermo.control", r)}</p>`;
	}
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.lang, n = e.season, r = this.readOnly || n.mode !== "auto";
		return O`<section class="card" aria-labelledby="h-season">
      <div class="card-head">
        <h2 id="h-season">${R(t, "section.season")}</h2>
        <hh-hint .lang=${t} .text=${R(t, "season.note")}></hh-hint>
      </div>
      <div class="field">
        <span class="lbl">${R(t, "season.mode")}</span>
        <hh-seg
          .label=${R(t, "season.mode")}
          .options=${er.map((e) => ({
			value: e,
			label: R(t, `season.mode.${e}`)
		}))}
          .value=${n.mode}
          .disabled=${this.readOnly}
          @hh-select=${(t) => this.edit({
			...e,
			season: {
				...n,
				mode: t.detail.value
			}
		})}
        ></hh-seg>
      </div>
      ${X(this, e, "season.threshold", R(t, "season.threshold"), `${G(n.threshold, 1, t)}°`, r)}
      <div class="pair">
        ${X(this, e, "season.window_hours", R(t, "season.window"), ze(t, "hours", n.window_hours), r)}
        ${X(this, e, "season.hysteresis", R(t, "season.hysteresis"), `${G(n.hysteresis, 1, t)}°`, r)}
      </div>
      ${this.status ? O`<p class="small">${Hn(this.status, e, t)}</p>` : j}
      <div class="card-head">
        <h3>${R(t, "layers.title")}</h3>
        <hh-hint .lang=${t} .text=${R(t, "layers.note")}></hh-hint>
      </div>
      <div class="layers">
        ${Ke.map((n) => O`<div class="layer">
            <span>${R(t, `layers.${n}`)}</span>
            <hh-seg
              small
              .label=${R(t, `layers.${n}`)}
              .options=${tr.map((e) => ({
			value: e,
			label: R(t, `layer_mode.${e}`)
		}))}
              .value=${e.layers[n]}
              .disabled=${this.readOnly}
              @hh-select=${(t) => this.edit({
			...e,
			layers: {
				...e.layers,
				[n]: t.detail.value
			}
		})}
            ></hh-seg>
          </div>`)}
      </div>
      ${this.controlWarning()}
      ${this.version ? O`<p class="small muted">Hybrid Heating ${this.version}</p>` : j}
    </section>`;
	}
});
// src/sections/hh-suggestions.ts
var nr = /* @__PURE__ */ new Set([
	"curve",
	"heat_loss",
	"feedback"
]);
L("hh-suggestions", class extends F {
	static properties = {
		lang: {},
		suggestions: { attribute: !1 },
		canAct: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.suggestions = void 0, this.canAct = !1;
	}
	static styles = [V, o`
      .sugg {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sg {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sg-h {
        display: flex;
        gap: 8px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .tag {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .act {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sg.done {
        opacity: 0.6;
      }
    `];
	act(e) {
		I(this, "hh-action", e);
	}
	item(e) {
		let t = this.lang, n = nr.has(e.kind) ? R(t, `suggestion.kind.${e.kind}`) : e.kind;
		return O`<div class="sg ${e.state === "applied" || e.state === "dismissed" ? "done" : ""}">
      <div class="sg-h"><span class="tag">${n}</span><b>${e.title}</b></div>
      <p class="note">${e.detail}</p>
      ${e.state === "new" && this.canAct ? O`<div class="act">
            <button class="btn sm primary" type="button" @click=${() => this.act({
			kind: "apply",
			id: e.id
		})}>
              ${R(t, "suggestion.apply")}
            </button>
            <button class="btn sm" type="button" @click=${() => this.act({
			kind: "dismiss",
			id: e.id
		})}>
              ${R(t, "suggestion.dismiss")}
            </button>
          </div>` : e.state === "applied" ? O`<p class="small muted">${R(t, "suggestion.applied")}</p>` : e.state === "dismissed" ? O`<p class="small muted">${R(t, "suggestion.dismissed")}</p>` : j}
    </div>`;
	}
	render() {
		let e = this.lang, t = this.suggestions;
		return O`<section class="card" aria-labelledby="h-sugg">
      <div class="card-head">
        <h2 id="h-sugg">${R(e, "section.suggestions")}</h2>
        <hh-hint .lang=${e} .text=${R(e, "suggestions.note")}></hh-hint>
      </div>
      ${t === void 0 ? O`<p class="note">…</p>` : t === null ? O`<p class="note">${R(e, "stage5.suggestions")}</p>` : t.length ? O`<div class="sugg">${t.map((e) => this.item(e))}</div>` : O`<p class="note">${R(e, "suggestions.empty")}</p>`}
    </section>`;
	}
}), L("hh-why", class extends F {
	static properties = {
		lang: {},
		view: { attribute: !1 }
	};
	constructor() {
		super(), this.lang = "en", this.view = null;
	}
	static styles = [V, o`
      .summary {
        font-size: 15px;
        font-weight: 600;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 11px;
        font-size: 13px;
        white-space: nowrap;
      }
      .why {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .why li {
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }
      .pip {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 5px;
      }
      b {
        font-weight: 600;
      }
      .pip-ac {
        background: var(--ac);
      }
      .pip-heat {
        background: var(--heat);
      }
      .pip-idle {
        background: var(--line-strong);
      }
      .pip-cold {
        background: var(--cold);
      }
      .pip-ok {
        background: var(--ok);
      }
    `];
	render() {
		let e = this.view;
		return e ? O`<section class="card" aria-labelledby="h-why">
      <div class="card-head">
        <h2 id="h-why">${R(this.lang, "section.why")}</h2>
        <p class="summary">${e.summary}</p>
        <p class="note">${e.sub}</p>
      </div>
      <div class="chips">
        ${e.chips.map((e) => O`<span class="chip">${e.label} <span class="num">${e.value}</span></span>`)}
      </div>
      <ul class="why">
        ${e.items.map((e) => O`<li>
            <span class="pip pip-${e.pip}"></span><span>${e.lead ? O`<b>${e.lead}</b> ` : null}${e.text}</span>
          </li>`)}
      </ul>
    </section>` : null;
	}
});
// src/sections/hh-zone-editor.ts
var rr = [
	"off",
	"backup",
	"main"
];
L("hh-zone-editor", class extends F {
	static properties = {
		lang: {},
		settings: { attribute: !1 },
		model: { attribute: !1 },
		sel: { attribute: !1 },
		readOnly: { type: Boolean }
	};
	constructor() {
		super(), this.lang = "en", this.settings = null, this.model = null, this.sel = 0, this.readOnly = !1;
	}
	static styles = [V, o`
      .warn {
        display: block;
      }
    `];
	edit(e) {
		I(this, "hh-edit", { next: e });
	}
	render() {
		let e = this.settings;
		if (!e) return j;
		let t = this.lang, n = this.sel, r = e.zones, i = r.policies[n], a = this.model?.rod_kw ?? 2, o = i.ac_rooms.length > 0 && yt(r.bounds, n) < e.ac.min_outdoor;
		return O`<section class="card" aria-labelledby="h-zone">
      <div class="card-head">
        <h2 id="h-zone">${R(t, "zone.title", { name: Y(n, t) })}</h2>
        <p class="note">${R(t, "zone_editor.range", { range: bt(n, r.bounds, t) })}</p>
        <p class="small">${St(i, t)}${!e.hybrid && i.ac_rooms.length ? R(t, "zones.hybrid_off") : ""}</p>
      </div>
      <div class="field">
        <span class="lbl">${R(t, "zone_editor.acs")}</span>
        <div class="pair">
          ${z.map((a) => O`<hh-switch
              .checked=${i.ac_rooms.includes(a)}
              .label=${R(t, `room.${a}`)}
              .disabled=${this.readOnly}
              @hh-toggle=${() => this.edit({
			...e,
			zones: wt(r, n, a)
		})}
            ></hh-switch>`)}
        </div>
        ${o ? O`<p class="warn">${R(t, "zone_editor.ac_cold", { t: K(e.ac.min_outdoor, t) })}</p>` : O`<p class="note">${R(t, "zone_editor.ac_note")}</p>`}
      </div>
      <div class="field">
        <span class="lbl">${R(t, "zone_editor.boiler")}</span>
        <hh-seg
          .label=${R(t, "zone_editor.boiler")}
          .options=${rr.map((e) => ({
			value: e,
			label: R(t, `boiler.${e}`)
		}))}
          .value=${i.boiler}
          .disabled=${this.readOnly}
          @hh-select=${(t) => this.edit({
			...e,
			zones: Tt(r, n, t.detail.value)
		})}
        ></hh-seg>
        <hh-hint .lang=${t} .text=${R(t, `boiler_note.${i.boiler}`)}></hh-hint>
      </div>
      <div class="field">
        <span class="lbl">${R(t, "zone_editor.rods")}</span>
        <hh-seg
          .label=${R(t, "zone_editor.rods")}
          .options=${[
			1,
			2,
			3
		].map((e) => ({
			value: String(e),
			label: String(e)
		}))}
          .value=${String(i.max_rods)}
          .disabled=${this.readOnly}
          @hh-select=${(t) => this.edit({
			...e,
			zones: Et(r, n, Number(t.detail.value))
		})}
        ></hh-seg>
        <hh-hint .lang=${t} .text=${R(t, "zone_editor.rods_note", { kw: q(i.max_rods * a, t) })}></hh-hint>
      </div>
    </section>`;
	}
});
// src/store.ts
var ir = 20, ar = 18e5, or = {
	phase: "loading",
	error: null,
	config: null,
	saved: null,
	draft: null,
	dirty: !1,
	saving: !1,
	status: null,
	log: [],
	forecast: void 0,
	suggestions: void 0,
	plan: void 0
}, sr = class {
	api;
	o;
	view = or;
	timer;
	polling = !1;
	forecastAt = 0;
	constructor(e, t) {
		this.api = e, this.o = t;
	}
	set(e) {
		this.view = {
			...this.view,
			...e
		}, this.o.onChange();
	}
	problem(e) {
		let t = e instanceof Me ? e : new Me("unknown_error", String(e));
		return t.code === "unknown_command" ? R(this.o.lang(), "error.not_set_up") : t.code === "not_loaded" ? R(this.o.lang(), "error.not_loaded") : t.code === "invalid_config" ? t.message : R(this.o.lang(), "error.generic", { message: t.message });
	}
	async start() {
		this.view.phase === "ready" ? this.poll() : await this.load(), this.timer === void 0 && (this.timer = setInterval(() => {
			this.visible() && (this.view.phase === "error" ? this.load() : this.poll());
		}, this.o.pollMs ?? 15e3), typeof document < "u" && document.addEventListener("visibilitychange", this.onVisibility));
	}
	stop() {
		clearInterval(this.timer), this.timer = void 0, typeof document < "u" && document.removeEventListener("visibilitychange", this.onVisibility);
	}
	visible() {
		return typeof document > "u" || document.visibilityState === "visible";
	}
	onVisibility = () => {
		this.visible() && this.poll();
	};
	async optional(e) {
		try {
			return await e();
		} catch {
			return;
		}
	}
	async forecast() {
		return this.forecastAt = Date.now(), this.optional(() => this.api.getForecast());
	}
	async load() {
		let e = this.o.lang();
		this.view.phase !== "error" && this.set({ ...or });
		try {
			let t = await this.api.getConfig(), [n, r, i, a, o] = await Promise.all([
				this.api.getStatus(e),
				this.api.getLog(e, ir),
				this.forecast(),
				this.optional(() => this.api.getSuggestions(e)),
				this.optional(() => this.api.getPlan())
			]);
			this.set({
				phase: "ready",
				config: t,
				saved: t.settings,
				draft: t.settings,
				dirty: !1,
				status: n,
				log: r,
				forecast: i,
				suggestions: a,
				plan: o ?? null,
				error: null
			});
		} catch (e) {
			this.set({
				phase: "error",
				error: this.problem(e)
			});
		}
	}
	async poll(e = !1) {
		if (this.view.phase !== "ready" || this.polling) return;
		this.polling = !0;
		let t = this.o.lang(), n = this.view.status;
		try {
			let r = await this.api.getStatus(t);
			r.revision !== this.view.config?.revision && this.adopt(await this.api.getConfig());
			let i = { status: r };
			(e || r.seq.log !== n?.seq.log) && (i.log = await this.api.getLog(t, ir));
			let a = this.view.suggestions;
			(a === void 0 || a !== null && (e || r.seq.suggestions !== n?.seq.suggestions)) && (i.suggestions = await this.optional(() => this.api.getSuggestions(t)));
			let o = this.view.forecast;
			(o === void 0 || o !== null && Date.now() - this.forecastAt >= ar) && (i.forecast = await this.forecast()), this.set(i);
		} catch {
			this.o.onChange();
		} finally {
			this.polling = !1;
		}
	}
	adopt(e, t = !0) {
		let { saved: n, draft: r } = this.view, i = t && n && r ? at(n, e.settings, r) : e.settings;
		this.set({
			config: e,
			saved: e.settings,
			draft: i,
			dirty: rt(e.settings, i)
		});
	}
	edit(e) {
		this.view.saved && this.set({
			draft: e,
			dirty: rt(this.view.saved, e)
		});
	}
	discard() {
		this.set({
			draft: this.view.saved,
			dirty: !1
		});
	}
	async save() {
		let { saved: e, draft: t } = this.view;
		if (e && t && !this.view.saving) {
			this.set({ saving: !0 });
			try {
				this.adopt(await this.api.setConfig(nt(e, t)), !1), this.o.notify(R(this.o.lang(), "saved"));
			} catch (e) {
				this.o.notify(this.problem(e));
			} finally {
				this.set({ saving: !1 });
			}
		}
	}
	async act(e) {
		try {
			await e();
		} catch (e) {
			this.o.notify(this.problem(e));
		}
	}
	setPreset(e) {
		return this.act(async () => {
			let t = this.view.config;
			t && await this.api.setPreset(t.controls.preset, e);
		});
	}
	setHybrid(e) {
		return this.act(async () => {
			let t = this.view.config;
			t && await this.api.setHybrid(t.controls.hybrid, e);
		});
	}
	async refreshSuggestions() {
		this.set({ suggestions: await this.api.getSuggestions(this.o.lang()) });
	}
	feedback(e, t) {
		return this.act(async () => {
			let n = this.o.lang(), r = await this.api.feedback(e, t, n);
			r && (this.o.notify(R(n, "feedback.toast", {
				room: R(n, `room_low.${e}`),
				kind: R(n, `feedback.kind.${t}`)
			})), r.suggestion && await this.refreshSuggestions());
		});
	}
	reloadPlan() {
		return this.act(async () => this.set({ plan: await this.api.getPlan() }));
	}
	applySuggestion(e) {
		return this.act(async () => {
			let t = this.o.lang(), n = this.view.suggestions?.find((t) => t.id === e)?.title;
			this.adopt(await this.api.applySuggestion(e, t)), n && this.o.notify(R(t, "suggestion.applied_toast", { title: n })), await this.refreshSuggestions(), this.set({ log: await this.api.getLog(t, ir) });
		});
	}
	dismissSuggestion(e) {
		return this.act(async () => {
			await this.api.dismissSuggestion(e), await this.refreshSuggestions();
		});
	}
}, cr = "hybrid-heating-card.tab";
function lr() {
	try {
		let e = localStorage.getItem(cr);
		return Jt.some((t) => t.key === e) ? e : "now";
	} catch {
		return "now";
	}
}
L("hybrid-heating-card", class extends F {
	static properties = {
		hass: { attribute: !1 },
		_config: { state: !0 },
		_view: { state: !0 },
		_ui: { state: !0 },
		_tab: { state: !0 }
	};
	store;
	constructor() {
		super(), this._tab = lr();
	}
	lastLang;
	static styles = [
		Xe,
		V,
		o`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* The card is a whole page: a panel view gives it the full width with no margin of its own. */
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px));
      }
      @container (min-width: 900px) {
        .wrap {
          padding: 24px 24px 32px;
        }
      }
      .two {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        align-items: start;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      @container (max-width: 940px) {
        .two,
        .pair {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `
	];
	setConfig(e) {
		this._config = He(e);
	}
	getCardSize() {
		return 30;
	}
	getGridOptions() {
		return { columns: "full" };
	}
	static getStubConfig() {
		return { type: "custom:hybrid-heating-card" };
	}
	static getConfigElement() {
		return document.createElement("hybrid-heating-card-editor");
	}
	get lang() {
		return Le(this.hass ? B(this.hass) : void 0);
	}
	get admin() {
		return this.hass?.user?.is_admin ?? !1;
	}
	onPlanChanged = () => void this.store?.reloadPlan();
	connectedCallback() {
		super.connectedCallback(), window.addEventListener(Ze, this.onPlanChanged), this.store && this.store.start();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener(Ze, this.onPlanChanged), this.store?.stop();
	}
	shouldUpdate(e) {
		if (e.size === 1 && e.has("hass")) {
			let t = this.thermostatId ? [this.thermostatId] : [];
			return Ye(e.get("hass"), this.hass, this._view?.config?.controls ?? null, t);
		}
		return !0;
	}
	willUpdate(e) {
		e.has("hass") && this.hass && (this.toggleAttribute("dark", this.hass.themes?.darkMode ?? !1), this.store ? this.lastLang !== void 0 && this.lastLang !== this.lang && this.store.poll(!0) : (this.store = new sr(new Fe(() => this.hass), {
			lang: () => this.lang,
			notify: (e) => I(this, "hass-notification", { message: e }),
			onChange: () => this.adoptView()
		}), this.isConnected && this.store.start()), this.lastLang = this.lang);
	}
	adoptView() {
		let e = this.store.view;
		if (!this._ui && e.status) {
			let t = e.status;
			this._ui = {
				sel: t.zone,
				probe: t.t_out ?? t.t_out_window_mean ?? 0,
				fsel: null
			};
		}
		this._view = e;
	}
	get model() {
		let e = this._config;
		return zt({
			...this._view?.config?.model,
			...e?.tariff_per_kwh === void 0 ? {} : { tariff_per_kwh: e.tariff_per_kwh },
			...e?.currency ? { currency: e.currency } : {}
		});
	}
	get thermostatId() {
		let e = this._view?.config?.entities.thermostat;
		return typeof e == "string" ? e : void 0;
	}
	get tz() {
		return this.hass?.config?.time_zone ?? "UTC";
	}
	withLive(e) {
		let t = this._view?.config;
		return !e || !t || !this.hass ? e : ot(e, Je(this.hass, t.controls));
	}
	get settings() {
		return this.withLive(this._view?.draft ?? null);
	}
	get running() {
		return this.withLive(this._view?.saved ?? null);
	}
	onAction(e) {
		let t = this.store;
		if (!t) return;
		let n = e.detail;
		switch (n.kind) {
			case "preset":
				t.setPreset(n.preset);
				break;
			case "hybrid":
				t.setHybrid(n.on);
				break;
			case "feedback":
				t.feedback(n.room, n.value);
				break;
			case "apply":
				t.applySuggestion(n.id);
				break;
			case "dismiss":
				t.dismissSuggestion(n.id);
				break;
			case "save":
				t.save();
				break;
			case "discard": t.discard();
		}
	}
	isHidden(e) {
		return this._config?.hide_sections.includes(e) ?? !1;
	}
	section(e) {
		let t = this._view, n = this.lang, r = this.settings;
		switch (e) {
			case "plan": return O`<hh-floor-plan
          .lang=${n}
          .plan=${t.plan ?? yn}
          .schematic=${!t.plan}
          .status=${t.status}
          .offsets=${this.running?.room_offsets ?? {}}
          .settings=${this.running}
          .learning=${t.suggestions !== null}
        ></hh-floor-plan>`;
			case "why": return t.status && this.running ? O`<hh-why .lang=${n} .view=${vn(t.status, this.running, n, this.tz)}></hh-why>` : j;
			case "curve": return O`<hh-curve-card
          .lang=${n}
          .settings=${r}
          .tOut=${t.status?.t_out ?? null}
          .ui=${this._ui ?? null}
          .readOnly=${!this.admin}
        ></hh-curve-card>`;
			case "forecast": return O`<hh-forecast
          .lang=${n}
          .settings=${r}
          .model=${this.model}
          .forecast=${t.forecast}
          .fsel=${this._ui?.fsel ?? null}
          .tz=${this.tz}
        ></hh-forecast>`;
			case "probe": return O`<hh-probe
          .lang=${n}
          .settings=${r}
          .model=${this.model}
          .probe=${this._ui?.probe ?? 0}
          .tOut=${t.status?.t_out ?? null}
        ></hh-probe>`;
			case "zone": return O`<hh-zone-editor
          .lang=${n}
          .settings=${r}
          .model=${this.model}
          .sel=${this._ui?.sel ?? 0}
          .readOnly=${!this.admin}
        ></hh-zone-editor>`;
			case "rooms": return O`<hh-rooms
          .lang=${n}
          .settings=${r}
          .status=${t.status}
          .learning=${t.suggestions !== null}
          .readOnly=${!this.admin}
        ></hh-rooms>`;
			case "load": return O`<hh-load .lang=${n} .settings=${r} .status=${t.status} .readOnly=${!this.admin}></hh-load>`;
			case "season": return O`<hh-season
          .lang=${n}
          .settings=${r}
          .status=${t.status}
          .readOnly=${!this.admin}
          .version=${t.config?.version ?? ""}
          .thermostat=${this.thermostatId ? this.hass?.states[this.thermostatId] : void 0}
          .savedBoiler=${t.saved?.layers.boiler ?? "observe"}
        ></hh-season>`;
			case "suggestions": return O`<hh-suggestions
          .lang=${n}
          .suggestions=${t.suggestions}
          .canAct=${this.admin}
        ></hh-suggestions>`;
			case "log": return O`<hh-log
          .lang=${n}
          .entries=${t.log}
          .now=${t.status?.now ?? (/* @__PURE__ */ new Date()).toISOString()}
          .tz=${this.tz}
        ></hh-log>`;
			default: return j;
		}
	}
	get tab() {
		let e = Xt(this._config?.hide_sections ?? []);
		return e.includes(this._tab) ? this._tab : e[0] ?? "now";
	}
	openTab(e) {
		this._tab = e;
		try {
			localStorage.setItem(cr, e);
		} catch {}
	}
	rows(e) {
		return Jt.find((t) => t.key === e).rows.map(({ cls: e, cols: t }) => {
			let n = t.map((e) => e.filter((e) => !this.isHidden(e)).map((e) => this.section(e)).filter((e) => e !== j)).filter((e) => e.length).map((e) => e.length === 1 ? e[0] : O`<div class="stack">${e}</div>`);
			return n.length ? n.length === 1 ? n[0] : O`<div class=${e}>${n}</div>` : j;
		});
	}
	newSuggestions() {
		let e = this._view?.suggestions?.filter((e) => e.state === "new") ?? [];
		return !e.length || this.isHidden("suggestions") ? j : O`<hh-suggestions .lang=${this.lang} .suggestions=${e} .canAct=${this.admin}></hh-suggestions>`;
	}
	render() {
		let e = this._view, t = this.lang, n = e?.phase === "ready" ? this.running : null, r = O`<hh-header
      .lang=${t}
      .heading=${this._config?.title ?? ""}
      .version=${e?.config?.version ?? ""}
      .settings=${e?.phase === "ready" ? this.settings : null}
      .status=${n ? en(e?.status ?? null, n, t, {
			nowMs: Date.now(),
			tz: this.tz
		}) : null}
      .note=${n && !this.admin ? R(t, "read_only") : ""}
    ></hh-header>`;
		if (!e || e.phase === "loading") return O`<div class="wrap">${r}<p class="muted" role="status">${R(t, "loading")}</p></div>`;
		if (e.phase === "error") return O`<div class="wrap">${r}<p class="warn" role="alert">${e.error}</p></div>`;
		let i = this.tab, a = this.admin && e.saved && e.draft ? Qt(nt(e.saved, e.draft)) : /* @__PURE__ */ new Set();
		return O`<div
      class="wrap"
      @hh-action=${this.onAction}
      @hh-edit=${(e) => this.store?.edit(e.detail.next)}
      @hh-ui=${(e) => this._ui = {
			...this._ui,
			...e.detail
		}}
    >
      ${r}
      <hh-tabs
        .label=${R(t, "tabs.label")}
        .dirtyLabel=${R(t, "tab.unsaved")}
        .tabs=${Xt(this._config?.hide_sections ?? []).map((e) => ({
			key: e,
			label: R(t, `tab.${e}`),
			dirty: a.has(e)
		}))}
        .value=${i}
        @hh-tab=${(e) => this.openTab(e.detail.key)}
      ></hh-tabs>
      <div class="panel" role="tabpanel" aria-label=${R(t, `tab.${i}`)}>
        ${this.rows(i)} ${i === "now" ? this.newSuggestions() : j}
      </div>
      <hh-footer .lang=${t} .dirty=${e.dirty} .saving=${e.saving} .admin=${this.admin}></hh-footer>
    </div>`;
	}
}), L("hybrid-heating-card-editor", Qe), window.customCards ??= [], window.customCards.some((e) => e.type === "hybrid-heating-card") || window.customCards.push({
	type: "hybrid-heating-card",
	name: "Hybrid Heating",
	description: "Heat pumps first, the boiler fills in, within the load limit.",
	preview: !1
});
