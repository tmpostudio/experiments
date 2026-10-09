import{B as he,a as I,b as re,c as D,d as ae,e as h,f as H,g as k,h as le,j as ce,k as ee,l as X,m as te,n as de,p as W,q as G,s as Q,v as U,w as fe,x as ue,y as pe,z as F}from"./chunk-ZZQHAV3C.js";var me=new H,J=new h,R=class extends pe{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";let e=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],t=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],n=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(n),this.setAttribute("position",new ee(e,3)),this.setAttribute("uv",new ee(t,2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new F(t,6,1);return this.setAttribute("instanceStart",new U(n,3,0)),this.setAttribute("instanceEnd",new U(n,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new F(t,6,1);return this.setAttribute("instanceColorStart",new U(n,3,0)),this.setAttribute("instanceColorEnd",new U(n,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new ue(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new H);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),me.setFromBufferAttribute(t),this.boundingBox.union(me))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new k),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let i=0;for(let f=0,u=e.count;f<u;f++)J.fromBufferAttribute(e,f),i=Math.max(i,n.distanceToSquared(J)),J.fromBufferAttribute(t,f),i=Math.max(i,n.distanceToSquared(J));this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(e){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(e)}};W.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new re(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};G.line={uniforms:te.merge([W.common,W.fog,W.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};var A=class extends de{static get type(){return"LineMaterial"}constructor(e){super({uniforms:te.clone(G.line.uniforms),vertexShader:G.line.vertexShader,fragmentShader:G.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){e===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}};var ie=new D,ve=new h,ge=new h,m=new D,v=new D,M=new D,ne=new h,oe=new le,g=new he,ye=new h,K=new H,Y=new k,_=new D,z,T;function we(c,e,t){return _.set(0,0,-e,1).applyMatrix4(c.projectionMatrix),_.multiplyScalar(1/_.w),_.x=T/t.width,_.y=T/t.height,_.applyMatrix4(c.projectionMatrixInverse),_.multiplyScalar(1/_.w),Math.abs(Math.max(_.x,_.y))}function xe(c,e){let t=c.matrixWorld,n=c.geometry,i=n.attributes.instanceStart,f=n.attributes.instanceEnd,u=Math.min(n.instanceCount,i.count);for(let a=0,d=u;a<d;a++){g.start.fromBufferAttribute(i,a),g.end.fromBufferAttribute(f,a),g.applyMatrix4(t);let w=new h,p=new h;z.distanceSqToSegment(g.start,g.end,p,w),p.distanceTo(w)<T*.5&&e.push({point:p,pointOnLine:w,distance:z.origin.distanceTo(p),object:c,face:null,faceIndex:a,uv:null,uv1:null})}}function Se(c,e,t){let n=e.projectionMatrix,f=c.material.resolution,u=c.matrixWorld,a=c.geometry,d=a.attributes.instanceStart,w=a.attributes.instanceEnd,p=Math.min(a.instanceCount,d.count),x=-e.near;z.at(1,M),M.w=1,M.applyMatrix4(e.matrixWorldInverse),M.applyMatrix4(n),M.multiplyScalar(1/M.w),M.x*=f.x/2,M.y*=f.y/2,M.z=0,ne.copy(M),oe.multiplyMatrices(e.matrixWorldInverse,u);for(let S=0,V=p;S<V;S++){if(m.fromBufferAttribute(d,S),v.fromBufferAttribute(w,S),m.w=1,v.w=1,m.applyMatrix4(oe),v.applyMatrix4(oe),m.z>x&&v.z>x)continue;if(m.z>x){let E=m.z-v.z,b=(m.z-x)/E;m.lerp(v,b)}else if(v.z>x){let E=v.z-m.z,b=(v.z-x)/E;v.lerp(m,b)}m.applyMatrix4(n),v.applyMatrix4(n),m.multiplyScalar(1/m.w),v.multiplyScalar(1/v.w),m.x*=f.x/2,m.y*=f.y/2,v.x*=f.x/2,v.y*=f.y/2,g.start.copy(m),g.start.z=0,g.end.copy(v),g.end.z=0;let P=g.closestPointToPointParameter(ne,!0);g.at(P,ye);let q=I.lerp(m.z,v.z,P),C=q>=-1&&q<=1,O=ne.distanceTo(ye)<T*.5;if(C&&O){g.start.fromBufferAttribute(d,S),g.end.fromBufferAttribute(w,S),g.start.applyMatrix4(u),g.end.applyMatrix4(u);let E=new h,b=new h;z.distanceSqToSegment(g.start,g.end,b,E),t.push({point:b,pointOnLine:E,distance:z.origin.distanceTo(b),object:c,face:null,faceIndex:S,uv:null,uv1:null})}}}var Z=class extends X{constructor(e=new R,t=new A({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,i=new Float32Array(2*t.count);for(let u=0,a=0,d=t.count;u<d;u++,a+=2)ve.fromBufferAttribute(t,u),ge.fromBufferAttribute(n,u),i[a]=a===0?0:i[a-1],i[a+1]=i[a]+ve.distanceTo(ge);let f=new F(i,2,1);return e.setAttribute("instanceDistanceStart",new U(f,1,0)),e.setAttribute("instanceDistanceEnd",new U(f,1,1)),this}raycast(e,t){let n=this.material.worldUnits,i=e.camera;i===null&&!n&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');let f=e.params.Line2!==void 0&&e.params.Line2.threshold||0;z=e.ray;let u=this.matrixWorld,a=this.geometry,d=this.material;T=d.linewidth+f,a.boundingSphere===null&&a.computeBoundingSphere(),Y.copy(a.boundingSphere).applyMatrix4(u);let w;if(n)w=T*.5;else{let x=Math.max(i.near,Y.distanceToPoint(z.origin));w=we(i,x,d.resolution)}if(Y.radius+=w,z.intersectsSphere(Y)===!1)return;a.boundingBox===null&&a.computeBoundingBox(),K.copy(a.boundingBox).applyMatrix4(u);let p;if(n)p=T*.5;else{let x=Math.max(i.near,K.distanceToPoint(z.origin));p=we(i,x,d.resolution)}K.expandByScalar(p),z.intersectsBox(K)!==!1&&(n?xe(this,t):Se(this,i,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(ie),this.material.uniforms.resolution.value.set(ie.z,ie.w))}};var B=class extends R{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let i=0;i<t;i+=3)n[2*i]=e[i],n[2*i+1]=e[i+1],n[2*i+2]=e[i+2],n[2*i+3]=e[i+3],n[2*i+4]=e[i+4],n[2*i+5]=e[i+5];return super.setPositions(n),this}setColors(e){let t=e.length-3,n=new Float32Array(2*t);for(let i=0;i<t;i+=3)n[2*i]=e[i],n[2*i+1]=e[i+1],n[2*i+2]=e[i+2],n[2*i+3]=e[i+3],n[2*i+4]=e[i+4],n[2*i+5]=e[i+5];return super.setColors(n),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}};var j=class extends Z{constructor(e=new B,t=new A({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type="Line2"}};var be=16,Ee=12,Me=.6,se=(c,e)=>{let t=Math.sin((c+1)*e)*43758.5453;return t-Math.floor(t)};function Ve(){let c=[{key:"lineWidth",label:"Line weight",min:.5,max:8,step:.1,value:1.2,unit:"px"},{key:"count",label:"Dots",min:3,max:40,step:1,value:40},{key:"spread",label:"Cluster size",min:.5,max:4,step:.01,value:4},{key:"dotRadius",label:"Dot size",min:0,max:.4,step:.005,value:.05},{key:"firing",label:"Firing rate",min:0,max:10,step:.1,value:2.5,unit:"/s"},{key:"drawSpeed",label:"Draw speed",min:.2,max:5,step:.1,value:2.4},{key:"impact",label:"Impact",type:"toggle",labels:["Off","On"],value:1},{key:"rotation",label:"Rotation",min:0,max:1,step:.01,value:.15},{key:"tilt",label:"Tilt",min:-90,max:90,step:1,value:0,unit:"\xB0"}],e=Object.fromEntries(c.map(s=>[s.key,s.value])),t=new Q,n=new Q;t.add(n);let i=new A({color:0,linewidth:e.lineWidth}),f=new ce({color:0}),u=new fe(1,48,24);function a(s){let o=se(s,127.1)*Math.PI*2,r=Math.acos(2*se(s,269.5)-1),y=e.spread*Math.cbrt(se(s,419.2));return new h(y*Math.sin(r)*Math.cos(o),y*Math.cos(r),y*Math.sin(r)*Math.sin(o))}let d=new Q;n.add(d);let w=new B;{let s=[];for(let o=0;o<=64;o++){let r=o/64*Math.PI*2;s.push(Math.cos(r),Math.sin(r),0)}w.setPositions(s)}let p=[];for(let s=0;s<Ee;s++){let o=new A({color:0,linewidth:e.lineWidth,transparent:!0,opacity:1}),r=new j(w,o);r.visible=!1,n.add(r),p.push({ring:r,material:o,active:!1,age:0})}function x(s){let o=p.find(r=>!r.active)||p.reduce((r,y)=>y.age>r.age?y:r);o.active=!0,o.age=0,o.ring.position.copy(s),o.ring.scale.setScalar(1e-4),o.ring.visible=!0}let S=[];for(let s=0;s<be;s++){let o=new B;o.setPositions([0,0,0,1,0,0]);let r=new j(o,i);r.visible=!1,n.add(r),S.push({line:r,geometry:o,active:!1,a:0,b:0,p:0})}function V(){for(let o of[...d.children])d.remove(o);let s=Math.round(e.count);for(let o=0;o<s;o++){let r=new X(u,f);r.position.copy(a(o)),r.visible=e.dotRadius>0,r.scale.setScalar(Math.max(e.dotRadius,1e-4)),d.add(r)}for(let o of S)o.active=!1,o.line.visible=!1}V();let N=0,P=0;function q(){let s=d.children.length;if(s<2)return;let o=S.find(l=>!l.active);if(!o)return;let r=Math.floor(Math.random()*s),y=Math.floor(Math.random()*(s-1));y>=r&&(y+=1),o.active=!0,o.a=r,o.b=y,o.p=0,o.hitFired=!1}let C=new h,O=new h,E=new h,b=new h;return{name:"10 \u2014 Automation",group:t,params:c,set(s,o){if(e[s]=o,s==="lineWidth"){i.linewidth=o;for(let r of p)r.material.linewidth=o}else if(s==="tilt")t.rotation.z=-I.degToRad(o);else if(s==="dotRadius")for(let r of d.children)r.visible=o>0,r.scale.setScalar(Math.max(o,1e-4));else(s==="count"||s==="spread")&&V()},setResolution(s,o){i.resolution.set(s,o);for(let r of p)r.material.resolution.set(s,o)},update(s,o){n.rotation.y+=e.rotation*s,e.firing>0&&(N+=s,N>=P&&(N=0,P=1/e.firing*(.7+Math.random()*.6),q()));for(let l of S){if(!l.active)continue;l.p+=e.drawSpeed*s,!l.hitFired&&l.p>=1&&(l.hitFired=!0,e.impact===1&&x(d.children[l.b].position));let L=Math.min(l.p,1),$=I.clamp(l.p-1,0,1);if($>=1){l.active=!1,l.line.visible=!1;continue}C.copy(d.children[l.a].position),O.copy(d.children[l.b].position),b.copy(C).lerp(O,$),E.copy(C).lerp(O,L),l.geometry.setPositions([b.x,b.y,b.z,E.x,E.y,E.z]),l.line.visible=L-$>.001}let r=Math.max(e.dotRadius*6,.3),y=null;o&&(y=n.getWorldQuaternion(new ae).invert().multiply(o.camera.quaternion));for(let l of p){if(!l.active)continue;l.age+=s;let L=l.age/Me;if(L>=1){l.active=!1,l.ring.visible=!1;continue}l.ring.scale.setScalar(Math.max(r*Math.sqrt(L),1e-4)),l.material.opacity=Math.pow(1-L,1.5),y&&l.ring.quaternion.copy(y)}}}}export{A as a,B as b,j as c,Ve as d};
