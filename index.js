"use strict";

class BaseProp{
	constructor(attr){
		this.x = attr.x || 0; // 元素相对于父容器的基准点
		this.y = attr.y || 0; // 同上
		this.opacity = attr.opacity ?? 1; // 透明度
		this.parent = attr.parent || document.body; // 父节点, 在分组时候会有用
	}

	// 鼠标拖拽逻辑
	#animationLoop = () => {
		this.update({x : this.start_elX + this._pendingX - this.start_mouseX , y : this.start_elY + this._pendingY - this.start_mouseY});
		this.rAF_flag = false;
		//this.animation = requestAnimationFrame(this.#animationLoop);
	}

	#mdown = (event) => {
		cancelAnimationFrame(this.animation);
		this.start_mouseX = this._pendingX = event.clientX; // 鼠标初始坐标
		this.start_mouseY = this._pendingY = event.clientY;
		this.start_elX = this.x; // 元素初始的坐标
		this.start_elY = this.y;
		this.rAF_flag = false;
		// mousemove 与 mouseup 绑定到 document, 防止鼠标移出元素时事件中断
		document.addEventListener("mousemove", this.#mmove); 
		document.addEventListener("mouseup", this.#mup);
	}

	#mmove = (event) => {
		this._pendingX = event.clientX; // 缓存鼠标实时位置
		this._pendingY = event.clientY;
		if (!this.rAF_flag){
			this.animation = requestAnimationFrame(this.#animationLoop);
			this.rAF_flag = true
		}
	}

	#mup = () => {
		document.removeEventListener("mousemove", this.#mmove); 
		document.removeEventListener("mouseup", this.#mup);
	}

	init(tag, NS){ // NS 目前仅在绘制 svg 时候传入
		this.el = NS ? document.createElementNS(NS, tag) : document.createElement(tag); // 我出生了
		// 绑定监听器, 鼠标拖拽用
		this.el.addEventListener("mousedown", this.#mdown);
	}

	getExactPosition(){ // 获取元素相对于页面的实际坐标
		if (!this.parent.getExactPosition) return {x : this.x, y : this.y};
		const parent_exact_position = this.parent.getExactPosition();
		return {x : this.x + parent_exact_position.x, y : this.y + parent_exact_position.y};
	}

	update(update_attr){ // 从 update_attr 中获取属性并更新
		const keys = Object.keys(update_attr);
		for (let i = 0; i < keys.length; i++){
			let attr = keys[i];
			if (this.constructor.translate_dict[attr]){
				const val = update_attr[attr];
				this.applyAttr(attr, val);
				this[attr] = val;
			}
		}
		return this;
	}
}

class TextObject extends BaseProp{
	static tag = "p";
	static translate_dict = {x : "transform", y : "transform", font : "fontFamily", size : "fontSize", opacity : "opacity"};

	constructor(attr){
		super(attr);
		this.content = attr.content ?? "键入文本";
		this.font = attr.font || "Yu Mincho"; // 好看的游明朝体
		this.size = attr.size ?? 20; // 单位 px
	}

	draw(){
		super.init(TextObject.tag);
		this.update(this);
		this.parent.appendChild(this.el);
	}

	applyAttr(attr, val){
		switch(attr){
			case "x": this.el.style.transform = `translate(${val}px, ${this.y}px) `; break;
			case "y": this.el.style.transform = `translate(${this.x}px, ${val}px) `; break;
			case "size": this.el.style[TextObject.translate_dict[attr]] = val + "px"; break;
			default: this.el.style[TextObject.translate_dict[attr]] = val; break;
		}
	}

	update(update_attr){ // 传入的仅仅是要修改的参数, 例如 a.update({x : 100, y : 200}) 只会修改位置, 不会修改其它
		if(update_attr.content != null) {this.el.textContent = this.content = update_attr.content;}
		super.update(this);
	}
}

const shape_canvas = document.querySelector("#shape_canvas");
const svgNS = "http://www.w3.org/2000/svg";

function resizeSVG(){
	shape_canvas.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
}

resizeSVG();
window.addEventListener("resize", resizeSVG);

class ShapeObject extends BaseProp{
	static tag = "svg";

	constructor(attr){
		super(attr);
		this.parent = attr.parent || shape_canvas;
		this.color = attr.color || "black";
		this.size = attr.size ?? 2;
	}

	draw(){
		super.init(this.constructor.tag, svgNS);
		this.update(this);
		this.parent.appendChild(this.el);
	}

}

const deg = Math.PI / 180;

class Line extends ShapeObject{ // x, y 属性可以为空
	static tag = "line";
	static translate_dict = {x : "x1", y : "y1", dx : "x2", dy : "y2", color : "stroke", size : "stroke-width", line_cap : "stroke-linecap"};
	
	constructor(attr){
		attr = attr || {};
		super(attr);
		this.dx = attr.dx ?? 100; // x2 = x1 + dx = x + dx
		this.dy = attr.dy ?? 100; // y2 = y1 + dy = y + dy
		this.line_cap = attr.line_cap || "butt";
	}

	byAngleLength(data){ // {x:..., y:..., theta:..., length:...}, 角度制, 以浏览器底部为 x 轴逆时针计算
		const rad = -data.theta * deg; // HTML 页面的 y 轴是反着来的……哈哈
		[this.x, this.y, this.dx, this.dy] = [data.x, data.y, data.length * Math.cos(rad), data.length * Math.sin(rad)];
		return this;
	}

	byEndpoints(data){ // {x1:..., y1:..., x2:..., y2:...}, 最简单的, 接收两端点坐标
		[this.x, this.y, this.dx, this.dy] = [data.x1, data.y1, data.x2 - data.x1, data.y2 - data.y1];
		return this;
	}

	byScale(data){ // {obj:..., scale:..., x, y}, obj 处接收一个 Line 对象, 将它缩放 scale 倍, 起始顶点变为 (x, y)
		[this.x, this.y, this.dx, this.dy] = [data.x, data.y, data.obj.dx * data.scale, data.obj.dy * data.scale];
		return this;
	}

	getLength(){
		return Math.sqrt(this.dx ** 2 + this.dy ** 2);
	}

	getTheta(){
		return Math.atan2(- this.dy, this.dx) / deg;
	}
	
	applyAttr(attr, val){
		let new_val = val;
		switch(attr){
			case "x": this.el.setAttribute("x2", val + this.dx); break;
			case "y": this.el.setAttribute("y2", val + this.dy); break;
			case "dx": new_val += this.x; break;
			case "dy": new_val += this.y; break;
			case "size": new_val += "px"; break;
			default: break;
		}
		this.el.setAttribute(Line.translate_dict[attr], new_val);
	}
}

class Circle extends ShapeObject{
	static tag = "circle";
	static translate_dict = {x : "cx", y : "cy", r : "r", fill : "fill", size : "stroke-width", color : "stroke"};

	constructor(attr){
		attr = attr || {};
		super(attr);
		this.r = attr.r ?? 100;
		this.fill = attr.fill || "none"; // 默认空心
	}

	static dot(attr){
		return new Circle({x : attr.x, y : attr.y, r : 2});
	}

	byCenterRadius(data){ // {x:..., y:..., r:...}, 甚至比 Line 的 byEndPoints 还要简单…… 理想状况是根本不会用到
		[this.x, this.y, this.r] = [data.x, data.y, data.r];
		return this;
	}

	byThreePoints(data){ // {x1:..., y1:..., x2:..., y2:..., x3:..., y3:...}, 目前最难的一个, 接收三点坐标确定一个圆
		const dx1 = data.x3 - data.x2, dx2 = data.x1 - data.x3, dx3 = data.x2 - data.x1;
		const dy1 = data.y2 - data.y3, dy2 = data.y3 - data.y1, dy3 = data.y1 - data.y2;
		const det = 2 * (data.x1 * dy1 + data.x2 * dy2 + data.x3 * dy3);
		const p1 = data.x1 ** 2 + data.y1 ** 2, p2 = data.x2 ** 2 + data.y2 ** 2, p3 = data.x3 ** 2 + data.y3 ** 2;
		const centerX = (p1 * dy1 + p2 * dy2 + p3 * dy3) / det;
		const centerY = (p1 * dx1 + p2 * dx2 + p3 * dx3) / det;
		const r = Math.sqrt((centerX - data.x1) ** 2 + (centerY - data.y1) ** 2);
		[this.x, this.y, this.r] = [centerX, centerY, r];
		return this;
	}
	
	applyAttr(attr, val){
		this.el.setAttribute(Circle.translate_dict[attr], val);
	}

}

// 测试用
let a = new TextObject({x : 100, y : 400, content : "你好"});
a.draw();
a.update({content: "我是洛一"});

let b = new Line().byEndpoints({x1:100,y1:100,x2:200,y2:200});
b.draw();

let c = new Line().byAngleLength({x:100, y:100, theta:60, length:100});
c.draw();

let d = new Circle({color: "red"}).byCenterRadius({x:100, y:100, r:100});
d.draw();