'use strict';

class BaseProp {
	static translate_dict = { x: 'x', y: 'y', opacity: 'opacity' };

	constructor(attr = {}) {
		this.x = attr.x || 0; // 元素相对于父容器的基准点
		this.y = attr.y || 0; // 同上
		this.opacity = attr.opacity ?? 1; // 透明度
		this.parent = attr.parent || document.body; // 父节点, 在分组时候会有用
	}

	// 鼠标拖拽逻辑, 仅测试用!
	#animationLoop = () => {
		this.update({
			x: this.start_elX + this._pendingX - this.start_mouseX,
			y: this.start_elY + this._pendingY - this.start_mouseY
		});
		this.rAF_flag = false;
	};

	#mdown = (event) => {
		cancelAnimationFrame(this.animation);
		this.start_mouseX = this._pendingX = event.clientX; // 鼠标初始坐标
		this.start_mouseY = this._pendingY = event.clientY;
		this.start_elX = this.x; // 元素初始的坐标
		this.start_elY = this.y;
		this.rAF_flag = false;
		// mousemove 与 mouseup 绑定到 document, 防止鼠标移出元素时事件中断
		document.addEventListener('mousemove', this.#mmove);
		document.addEventListener('mouseup', this.#mup);
	};

	#mmove = (event) => {
		this._pendingX = event.clientX; // 缓存鼠标实时位置
		this._pendingY = event.clientY;
		if (!this.rAF_flag) {
			this.animation = requestAnimationFrame(this.#animationLoop);
			this.rAF_flag = true;
		}
	};

	#mup = () => {
		document.removeEventListener('mousemove', this.#mmove);
		document.removeEventListener('mouseup', this.#mup);
	};

	init(tag, NS) {
		// NS 目前仅在绘制 svg 时候传入
		this.el = NS ? document.createElementNS(NS, tag) : document.createElement(tag); // 我出生了
		// 绑定监听器, 鼠标拖拽用, 仅测试用
		if (this.el.nodeName !== 'DIV' && this.el.nodeName !== 'g') {
			// 不给 Group 绑定, 要不然有的元素可能会更新两次
			this.el.addEventListener('mousedown', this.#mdown);
		}
		return this;
	}

	applyAttr(attr, val) {
		switch (attr) {
			case 'x':
				this.el.style.transform = `translate(${val}px, ${this.y}px) `;
				break;
			case 'y':
				this.el.style.transform = `translate(${this.x}px, ${val}px) `;
				break;
			default:
				break;
		}
	}

	update(update_attr) {
		// 传入的仅仅是要修改的参数, 例如 a.update({x : 100, y : 200}) 只会修改位置, 不会修改其它
		const keys = Object.keys(update_attr);
		for (let i = 0; i < keys.length; i++) {
			const attr = keys[i];
			if (this.constructor.translate_dict[attr]) {
				const val = update_attr[attr];
				this.applyAttr(attr, val);
				this[attr] = val;
			}
		}
		return this;
	}

	hide() {
		this.el.style.display = 'none';
		return this;
	}

	display() {
		this.el.style.display = 'block';
		return this;
	}

	getExactPosition() {
		// 获取元素相对于页面的实际坐标
		if (!this.parent.getExactPosition) return { x: this.x, y: this.y };
		const parent_exact_position = this.parent.getExactPosition();
		return {
			x: this.x + parent_exact_position.x,
			y: this.y + parent_exact_position.y
		};
	}

	getWidth() {
		return this.el.getBoundingClientRect().width;
	}

	getHeight() {
		return this.el.getBoundingClientRect().height;
	}
}

class TextObject extends BaseProp {
	static tag = 'p';
	static translate_dict = {
		x: 'transform',
		y: 'transform',
		font: 'fontFamily',
		size: 'fontSize'
	};

	constructor(attr = {}) {
		super(attr);
		this.content = attr.content ?? '大江東去浪淘尽';
		this.font = attr.font || 'Yu Mincho'; // 好看的游明朝体
		this.size = attr.size ?? 20; // 单位 px
	}

	draw() {
		super.init(TextObject.tag);
		this.update(this);
		this.parent.appendChild(this.el);
		return this;
	}

	applyAttr(attr, val) {
		switch (attr) {
			case 'x':
				this.el.style.transform = `translate(${val}px, ${this.y}px) `;
				break;
			case 'y':
				this.el.style.transform = `translate(${this.x}px, ${val}px) `;
				break;
			case 'size':
				this.el.style[TextObject.translate_dict[attr]] = val + 'px';
				break;
			default:
				this.el.style[TextObject.translate_dict[attr]] = val;
				break;
		}
	}

	update(update_attr) {
		if (update_attr.content != null) this.el.textContent = this.content = update_attr.content;
		super.update(update_attr);
	}
}

const shape_canvas = document.querySelector('#shape_canvas');
const svgNS = 'http://www.w3.org/2000/svg';

function resizeSVG() {
	shape_canvas.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
}

resizeSVG(); // 确保调整窗口大小时 svg 画布不会变形. 由于这个事件不是很频繁所以就先不优化了()
window.addEventListener('resize', resizeSVG);

class ShapeObject extends BaseProp {
	static tag = 'svg';

	constructor(attr = {}) {
		super(attr);
		this.parent = attr.parent || shape_canvas;
		this.color = attr.color || 'black';
		this.size = attr.size ?? 2;
	}

	draw() {
		super.init(this.constructor.tag, svgNS);
		this.update(this);
		this.parent.appendChild(this.el);
		return this;
	}
}

const deg = Math.PI / 180;

class Line extends ShapeObject {
	// x, y 属性可以为空
	static tag = 'line';
	static translate_dict = {
		x: 'x1',
		y: 'y1',
		dx: 'x2',
		dy: 'y2',
		color: 'stroke',
		size: 'stroke-width',
		line_cap: 'stroke-linecap'
	};

	constructor(attr = {}) {
		super(attr);
		this.dx = attr.dx ?? 100; // x2 = x1 + dx = x + dx
		this.dy = attr.dy ?? 100; // y2 = y1 + dy = y + dy
		this.line_cap = attr.line_cap || 'butt';
	}

	applyAttr(attr, val) {
		let new_val = val;
		switch (attr) {
			case 'x':
				this.el.setAttribute('x2', val + this.dx);
				break;
			case 'y':
				this.el.setAttribute('y2', val + this.dy);
				break;
			case 'dx':
				new_val += this.x;
				break;
			case 'dy':
				new_val += this.y;
				break;
			case 'size':
				new_val += 'px';
				break;
			default:
				break;
		}
		this.el.setAttribute(Line.translate_dict[attr], new_val);
	}

	byAngleLength(x, y, theta, length) {
		// 角度制, 以浏览器底部为 x 轴逆时针计算
		const rad = -theta * deg; // HTML 页面的 y 轴是反着来的……哈哈
		[this.x, this.y, this.dx, this.dy] = [x, y, length * Math.cos(rad), length * Math.sin(rad)];
		return this;
	}

	byEndpoints(x1, y1, x2, y2) {
		// 最简单的, 接收两端点坐标
		[this.x, this.y, this.dx, this.dy] = [x1, y1, x2 - x1, y2 - y1];
		return this;
	}

	byScale(obj, scale, x, y) {
		// obj 处接收一个 Line 对象, 将它缩放 scale 倍, 起始顶点变为 (x, y)
		[this.x, this.y, this.dx, this.dy] = [x, y, obj.dx * scale, obj.dy * scale];
		return this;
	}

	getLength() {
		return Math.sqrt(this.dx ** 2 + this.dy ** 2);
	}

	getTheta() {
		return Math.atan2(-this.dy, this.dx) / deg;
	}
}

class Circle extends ShapeObject {
	static tag = 'circle';
	static translate_dict = {
		x: 'cx',
		y: 'cy',
		r: 'r',
		fill: 'fill',
		size: 'stroke-width',
		color: 'stroke'
	};

	constructor(attr = {}) {
		super(attr);
		this.r = attr.r ?? 100;
		this.fill = attr.fill || 'none'; // 默认空心
	}

	static dot(x, y, r = 2) {
		// 一个预设的 Dot 样式, 还要有别的就直接使用 Circle 吧
		return new Circle({ x: x, y: y, r: r });
	}

	applyAttr(attr, val) {
		this.el.setAttribute(Circle.translate_dict[attr], val);
	}

	byCenterRadius(x, y, r) {
		// 甚至比 Line 的 byEndPoints 还要简单…… 理想状况是根本不会用到
		[this.x, this.y, this.r] = [x, y, r];
		return this;
	}

	byThreePoints(x1, y1, x2, y2, x3, y3) {
		// 目前最难的一个, 接收三点坐标确定一个圆
		const dx1 = x3 - x2,
			dx2 = x1 - x3,
			dx3 = x2 - x1;
		const dy1 = y2 - y3,
			dy2 = y3 - y1,
			dy3 = y1 - y2;
		const det = 2 * (x1 * dy1 + x2 * dy2 + x3 * dy3);
		const p1 = x1 ** 2 + y1 ** 2,
			p2 = x2 ** 2 + y2 ** 2,
			p3 = x3 ** 2 + y3 ** 2;
		const centerX = (p1 * dy1 + p2 * dy2 + p3 * dy3) / det;
		const centerY = (p1 * dx1 + p2 * dx2 + p3 * dx3) / det;
		const r = Math.sqrt((centerX - x1) ** 2 + (centerY - y1) ** 2);
		[this.x, this.y, this.r] = [centerX, centerY, r];
		return this;
	}
}

// 这才是 BaseProp().parent 真正派上用场的时候! 伟大的分组功能!
class Group {
	constructor(attr = {}) {
		// 分别处理非 svg 组和 svg 组是由于二者所在的父容器和标签等细节均不一样
		// regualr_group (非 svg 组) 使用 div 标签, 父容器默认为 body, 不可进入 svg 标签
		// svg_group (svg 组) 使用 g 标签 (foreignObject 太丑陋, 不适合动态), 父容器默认为 svg, 不可逃逸
		if (attr.regular_group != null) {
			this.regular_group = attr.regular_group;
		} else {
			this.regular_group = new BaseProp();
			this.regular_group.init('div');
		}

		if (attr.svg_group != null) {
			this.svg_group = attr.svg_group;
		} else {
			this.svg_group = new BaseProp();
			this.svg_group.init('g', svgNS);
		}
		document.body.appendChild(this.regular_group.el);
		shape_canvas.appendChild(this.svg_group.el);
	}

	add(el) {
		for (let i = 0; i < el.length; i++) {
			if (el[i] instanceof ShapeObject) {
				this.svg_group.el.appendChild(el[i].el);
				el[i].parent = this.svg_group;
			} else {
				this.regular_group.el.appendChild(el[i].el);
				el[i].parent = this.regular_group;
			}
		}
		return this;
	}

	combine(group, obj) {
		// 计算一个组和一个组内普通对象 m 的属性应用在 m 上的等价结合属性值
		const keys = Object.keys(group);
		let combined_dict = {};
		for (let i = 0; i < keys.length; i++) {
			if (BaseProp.translate_dict[keys[i]] == null) {
				continue;
			}
			let group_val = group[keys[i]],
				obj_val = obj[keys[i]];
			switch (keys[i]) {
				case 'x': // fall through
				case 'y':
					combined_dict[keys[i]] = group_val + obj_val;
					break;
				case 'opacity':
					combined_dict[keys[i]] = group_val * obj_val;
					break;
				default:
					combined_dict[keys[i]] = group_val;
			}
		}
		obj.update(combined_dict);
		return obj;
	}

	remove(el, inheritance = true) {
		for (let i = 0; i < el.length; i++) {
			if (el[i] instanceof ShapeObject) {
				this.svg_group.el.removeChild(el[i].el);
				shape_canvas.appendChild(el[i].el);
				el[i].parent = document.body;
			} else {
				this.regular_group.el.removeChild(el[i].el);
				document.body.appendChild(el[i].el);
				el[i].parent = shape_canvas;
			}
			if (inheritance) {
				// 若是选择继承群组的属性
				this.combine(el[i] instanceof ShapeObject ? this.svg_group : this.regular_group, el[i]);
			}
		}
		return this;
	}

	update(attr) {
		this.regular_group.update(attr);
		this.svg_group.update(attr);
		return this;
	}
}

// 最伟大的设计! 时间轴!
class Timeline {
	constructor() {}
	to() {}
	add(start, duration, recall, anim_id) {
		anims.push({ start: start, duration: duration, recall: recall, anim_id: anim_id });
		return anims;
	}
	subTimeline() {}
	static pause() {
		cancelAnimationFrame(loop_id);
	}
}

let global_timeline = new Timeline();
let load_time,
	frames_cnt = 0,
	ms_cnt = 0,
	anims = [],
	idx_tail = 0,
	ms_text = new TextObject({ x: window.innerWidth - 200, y: 20, content: '0 0ms' }).draw(), // debug 用
	loop_id;

function loop() {
	if (frames_cnt === 0) {
		load_time = performance.now();
	}
	ms_cnt = performance.now() - load_time;
	ms_text.update({ content: `${frames_cnt} ${ms_cnt.toFixed(1)}ms` }); // debug 用
	frames_cnt++;
	while (anims[idx_tail].start <= ms_cnt) {
		console.log('frame: ', frames_cnt);
		anims[idx_tail].anim_id.temp_obj = { ...anims[idx_tail].anim_id.args.obj };
		idx_tail++;
	}
	for (let i = 0; i < idx_tail; i++) {
		if (anims[i].start + anims[i].duration < ms_cnt) {
			anims[i].anim_id.progress = 1;
			anims[i].recall(anims[i].anim_id.temp_obj);
			anims.splice(i, 1);
			idx_tail--;
			i--;
			continue;
		}
		anims[i].anim_id.progress = (ms_cnt - anims[i].start) / anims[i].duration;
		anims[i].recall(anims[i].anim_id.temp_obj);
	}
	loop_id = requestAnimationFrame(loop);
}

// 引擎的灵魂
class Anim {
	constructor(attr) {
		// this.playing = false; // 是否正在播放
		this.progress = attr.progress || 0;
		this.animation = attr.animation || undefined;
		this.args = attr.args || {};
		this.temp_obj = attr.temp_obj || undefined;
	}

	static customize(start, recall, duration = 0) {
		global_timeline.at(start, recall, duration);
		return;
	}

	static translate(start, duration, to, obj) {
		let r_anim = new Anim({ animation: Anim.translate, args: { start: start, duration: duration, to: to, obj: obj } });
		global_timeline.add(
			start,
			duration,
			(temp) => {
				obj.update({ x: temp.x + (to[0] - temp.x) * r_anim.progress, y: temp.y + (to[1] - temp.y) * r_anim.progress });
			},
			r_anim
		);
		return r_anim;
	}

	static mojibake(start, to, speed, obj, duration) {
		return [start, to, speed, obj, duration];
	}	
}

// 测试用
let a = new TextObject({ x: 100, y: 400, content: '你好' });
a.draw();
a.update({ content: '我是洛一' });

let b = new Line().byEndpoints(100, 100, 200, 200);
b.draw();

let c = new Line().byAngleLength(100, 100, 60, 100);
c.draw();

let d = new Circle({ color: 'red' }).byCenterRadius(100, 100, 100);
d.draw();

let e = Circle.dot(100, 400);
e.draw();

let f = new Group();
f;

let mouse_debugger = false,
	mouse_pos_dot = Circle.dot().draw().hide(),
	mouse_pos_text = new TextObject().draw().hide();

document.addEventListener('keydown', (e) => {
	if (e.key === 'Control') {
		mouse_debugger = !mouse_debugger;
	}
	if (!mouse_debugger) {
		mouse_pos_dot.hide();
		mouse_pos_text.hide();
	}
});
document.addEventListener('mousedown', (e) => {
	if (mouse_debugger) {
		mouse_pos_dot.display().update({ x: e.clientX, y: e.clientY });
		mouse_pos_text.display().update({ x: e.clientX, y: e.clientY, content: `(${e.clientX},${e.clientY})` });
	}
});

let g1 = Anim.translate(3000, 3000, [389, 352], a);
let g2 = Anim.translate(2000, 3000, [89, 202], b);

anims.sort((a, b) => a.start - b.start);
anims.push(0); // 利用 0 没有索引值, 所以 loop 内部的 while 判断条件在此时会返回 false
loop();
