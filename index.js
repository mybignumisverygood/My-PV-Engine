"use strict";

class BaseProp{
	constructor(attr){
		this.x = attr.x || 0; // 相对于父容器
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

	init(tag, NS){
		this.el = NS ? document.createElementNS(NS, tag) : document.createElement(tag); // 我出生了
		// 绑定监听器, 鼠标拖拽用
		this.el.addEventListener("mousedown", this.#mdown);
	}

	getExactPosition(){ // 获取元素相对于页面的实际坐标
		if (this.parent === document.body || this.parent === shape_canvas) return {x : this.x, y : this.y};
		const parent_exact_position = this.parent.getExactPosition();
		return {x : this.x + parent_exact_position.x, y : this.y + parent_exact_position.y};
	}

	update(){
		throw new Error("No update function in" + this.constructor.name);
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
		switch (attr){
			case "x": this.el.style.transform = `translate(${val}px, ${this.y}px) `; break;
			case "y": this.el.style.transform = `translate(${this.x}px, ${val}px) `; break;
			case "size": this.el.style[TextObject.translate_dict[attr]] = val + "px"; break;
			default: this.el.style[TextObject.translate_dict[attr]] = val; break;
		}
	}

	update(update_attr){ // 传入的仅仅是要修改的参数, 例如 a.update({x : 100, y : 200}) 只会修改位置, 不会修改其它
		if (update_attr.content != null) {this.el.textContent = this.content = update_attr.content;}
		const keys = Object.keys(update_attr);
		for (let i = 0; i < keys.length; i++){
			let attr = keys[i];
			if (TextObject.translate_dict[attr]){
				const val = update_attr[attr];
				this.applyAttr(attr, val);
				this[attr] = val;
			}
		}
		return this;
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
		this.parent = shape_canvas;
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
	static translate_dict = {x1 : "x1", y1 : "y1", x2 : "x2", y2 : "y2", color : "stroke", size : "stroke-width"};

	constructor(attr){
		attr = attr || {};
		super(attr);
		this.x1 = this.x = attr.x1 ?? 0;
		this.y1 = this.y = attr.y1 ?? 0;
		this.x2 = attr.x2 ?? 0;
		this.y2 = attr.y2 ?? 0;
	}

	byAngleLength(data){ // {x:..., y:..., theta:..., length:...}, 角度制, 以浏览器底部为 x 轴逆时针计算
		const rad = -data.theta * deg; // HTML 页面的 y 轴是反着来的……哈哈
		[this.x1, this.y1, this.x2, this.y2] = [data.x, data.y, data.x + data.length * Math.cos(rad), data.y + data.length * Math.sin(rad)];
		return this;
	}

	byEndpoint(data){ // {x1:..., y1:..., x2:..., y2:...}, 最简单的, 接收两端点坐标
		[this.x1, this.y1, this.x2, this.y2] = [data.x1, data.y1, data.x2, data.y2];
		return this;
	}

	byScale(data){ // {obj:..., scale:..., x, y}, obj 处接收一个 Line 对象, 将它缩放 scale 倍, 起始顶点变为 (x, y)
		[this.x1, this.y1, this.x2, this.y2] = [data.x, data.y, 
												data.x + (data.obj.x2 - data.obj.x1) * data.scale, data.y + (data.obj.y2 - data.obj.y1) * data.scale];
		return this;
	}

	getLength(){
		return Math.sqrt((this.x2 - this.x1) ** 2 + (this.y2 - this.y1) ** 2);
	}

	getTheta(){
		return Math.atan2(this.y1 - this.y2, this.x2 - this.x1) / deg;
	}
	
	applyAttr(attr, val){
		
	}

	update(update_attr){
		const style_dict = {x1 : update_attr.x1, y1 : update_attr.y1, x2 : update_attr.x2, y2 : update_attr.y2, stroke : update_attr.color, 
							  "stroke-width" : update_attr.size + "px"};
		const entries = Object.keys(update_attr);
		for (let i = 0; i < entries.length; i++){
			let translated_attr = Line.translate_dict[entries[i]];
			if (translated_attr){
				this.el.setAttribute(translated_attr, style_dict[translated_attr]);
				this[entries[i]] = update_attr[entries[i]];
			}
		}
		this.x = this.x1; this.y = this.y1;
		return this;
	}
}

// 测试用
let a = new TextObject({x : 100, y : 400, content : "你好"});
a.draw();
a.update({content: "我是洛一"});

let b = new Line().byEndpoint({x1:100,y1:100,x2:200,y2:200});
b.draw();

let c = new Line().byAngleLength({x:100, y:100, theta:60, length:100});
c.draw();