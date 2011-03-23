/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.LoaderOld = function( showStatus ) {
	
	this.showStatus = showStatus;
	
	this.statusDomElement = showStatus ? this.addStatusElement() : null;

};

THREE.LoaderOld.prototype = {

	addStatusElement: function ( ) {
		
		var e = document.createElement( "div" );
		
		e.style.fontSize = "0.8em"; 
		e.style.textAlign = "left";
		e.style.background = "#b00"; 
		e.style.color = "#fff"; 
		e.style.width = "140px"; 
		e.style.padding = "0.25em 0.25em 0.25em 0.5em"; 
		e.style.position = "absolute"; 
		e.style.right = "0px"; 
		e.style.top = "0px"; 
		e.style.zIndex = 1000;
		
		e.innerHTML = "Loading ...";
		
		return e;
		
	},
	
	updateProgress: function ( progress ) {

		var message = "Loaded ";

		if ( progress.total ) {

			message += ( 100 * progress.loaded / progress.total ).toFixed(0) + "%";


		} else {

			message += ( progress.loaded / 1000 ).toFixed(2) + " KB";

		}

		this.statusDomElement.innerHTML = message;

	},
	
	// Load models generated by Blender exporter and original OBJ converter (converter_obj_three.py)

	loadAsciiOld: function( url, callback ) {

		var element = document.createElement( 'script' );
		element.type = 'text/javascript';
		element.onload = callback;
		element.src = url;
		document.getElementsByTagName( "head" )[ 0 ].appendChild( element );

	},

	// Load models generated by slim OBJ converter with ASCII option (converter_obj_three_slim.py -t ascii)
	//  - parameters
	//		- model (required)
	//		- callback (required)
	//		- texture_path (optional: if not specified, textures will be assumed to be in the same folder as JS model file)

	loadAscii: function ( parameters ) {

		var url = parameters.model,
			callback = parameters.callback, 
		    texture_path = parameters.texture_path ? parameters.texture_path : THREE.LoaderOld.prototype.extractUrlbase( url ),
		
			s = (new Date).getTime(),
			worker = new Worker( url );
		
		worker.onmessage = function( event ) {
			
			THREE.LoaderOld.prototype.createModel( event.data, callback, texture_path );

		};

		worker.postMessage( s );

	},

	// Load models generated by slim OBJ converter with BINARY option (converter_obj_three_slim.py -t binary)
	//  - binary models consist of two files: JS and BIN
	//  - parameters
	//		- model (required)
	//		- callback (required)
	//		- bin_path (optional: if not specified, binary file will be assumed to be in the same folder as JS model file)
	//		- texture_path (optional: if not specified, textures will be assumed to be in the same folder as JS model file)

	loadBinary: function( parameters ) {
	
		// #1 load JS part via web worker

		//  This isn't really necessary, JS part is tiny,
		//  could be done by more ordinary means.

		var url = parameters.model,
			callback = parameters.callback, 
		    texture_path = parameters.texture_path ? parameters.texture_path : THREE.LoaderOld.prototype.extractUrlbase( url ),
			bin_path = parameters.bin_path ? parameters.bin_path : THREE.LoaderOld.prototype.extractUrlbase( url ),

			s = (new Date).getTime(),
			worker = new Worker( url ),
			callback_progress = this.showProgress ? THREE.LoaderOld.prototype.updateProgress : null;
		
		worker.onmessage = function( event ) {

			var materials = event.data.materials,
				buffers = event.data.buffers;

			// #2 load BIN part via Ajax

			//  For some reason it is faster doing loading from here than from within the worker.
			//  Maybe passing of ginormous string as message between threads is costly? 
			//  Also, worker loading huge data by Ajax still freezes browser. Go figure, 
			//  worker with baked ascii JSON data keeps browser more responsive.

			THREE.LoaderOld.prototype.loadAjaxBuffers( buffers, materials, callback, bin_path, texture_path, callback_progress );

		};

		worker.onerror = function (event) {

			alert( "worker.onerror: " + event.message + "\n" + event.data );
			event.preventDefault();

		};

		worker.postMessage( s );

	},

	// Binary AJAX parser based on Magi binary loader
	// https://github.com/kig/magi

	// Should look more into HTML5 File API
	// See also other suggestions by Gregg Tavares
	// https://groups.google.com/group/o3d-discuss/browse_thread/thread/a8967bc9ce1e0978

	loadAjaxBuffers: function( buffers, materials, callback, bin_path, texture_path, callback_progress ) {

		var xhr = new XMLHttpRequest(),
			url = bin_path + "/" + buffers;

		var length = 0;
		
		xhr.onreadystatechange = function() {
			
			if ( xhr.readyState == 4 ) {

				if ( xhr.status == 200 || xhr.status == 0 ) {

					THREE.LoaderOld.prototype.createBinModel( xhr.responseText, callback, texture_path, materials );

				} else {

					alert( "Couldn't load [" + url + "] [" + xhr.status + "]" );

				}
						
			} else if ( xhr.readyState == 3 ) {
				
				if ( callback_progress ) {
				
					if ( length == 0 ) {
						
						length = xhr.getResponseHeader( "Content-Length" );
						
					}
					
					callback_progress( { total: length, loaded: xhr.responseText.length } );
					
				}
				
			} else if ( xhr.readyState == 2 ) {
				
				length = xhr.getResponseHeader( "Content-Length" );
				
			}
			
		}

		xhr.open("GET", url, true);
		xhr.overrideMimeType("text/plain; charset=x-user-defined");
		xhr.setRequestHeader("Content-Type", "text/plain");
		xhr.send(null);

	},

	createBinModel: function ( data, callback, texture_path, materials ) {

		var Model = function ( texture_path ) {

			//var s = (new Date).getTime();

			var scope = this,
				currentOffset = 0, 
				md,
				normals = [],
				uvs = [],
				tri_b, tri_c, tri_m, tri_na, tri_nb, tri_nc,
				quad_b, quad_c, quad_d, quad_m, quad_na, quad_nb, quad_nc, quad_nd,
				tri_uvb, tri_uvc, quad_uvb, quad_uvc, quad_uvd,
				start_tri_flat, start_tri_smooth, start_tri_flat_uv, start_tri_smooth_uv,
				start_quad_flat, start_quad_smooth, start_quad_flat_uv, start_quad_smooth_uv,
				tri_size, quad_size,
				len_tri_flat, len_tri_smooth, len_tri_flat_uv, len_tri_smooth_uv,
				len_quad_flat, len_quad_smooth, len_quad_flat_uv, len_quad_smooth_uv;


			THREE.Geometry.call(this);

			THREE.LoaderOld.prototype.init_materials( scope, materials, texture_path );

			md = parseMetaData( data, currentOffset );
			currentOffset += md.header_bytes;

			// cache offsets
			
			tri_b   = md.vertex_index_bytes, 
			tri_c   = md.vertex_index_bytes*2, 
			tri_m   = md.vertex_index_bytes*3,
			tri_na  = md.vertex_index_bytes*3 + md.material_index_bytes,
			tri_nb  = md.vertex_index_bytes*3 + md.material_index_bytes + md.normal_index_bytes,
			tri_nc  = md.vertex_index_bytes*3 + md.material_index_bytes + md.normal_index_bytes*2,
		
			quad_b  = md.vertex_index_bytes,
			quad_c  = md.vertex_index_bytes*2,
			quad_d  = md.vertex_index_bytes*3,
			quad_m  = md.vertex_index_bytes*4,
			quad_na = md.vertex_index_bytes*4 + md.material_index_bytes,
			quad_nb = md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes,
			quad_nc = md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes*2,
			quad_nd = md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes*3,
		
			tri_uvb = md.uv_index_bytes,
			tri_uvc = md.uv_index_bytes * 2,
		
			quad_uvb = md.uv_index_bytes,
			quad_uvc = md.uv_index_bytes * 2,
			quad_uvd = md.uv_index_bytes * 3;
			
			// buffers sizes
			
			tri_size =  md.vertex_index_bytes * 3 + md.material_index_bytes;
			quad_size = md.vertex_index_bytes * 4 + md.material_index_bytes;

			len_tri_flat      = md.ntri_flat      * ( tri_size );
			len_tri_smooth    = md.ntri_smooth    * ( tri_size + md.normal_index_bytes * 3 );
			len_tri_flat_uv   = md.ntri_flat_uv   * ( tri_size + md.uv_index_bytes * 3 );
			len_tri_smooth_uv = md.ntri_smooth_uv * ( tri_size + md.normal_index_bytes * 3 + md.uv_index_bytes * 3 );

			len_quad_flat      = md.nquad_flat      * ( quad_size );
			len_quad_smooth    = md.nquad_smooth    * ( quad_size + md.normal_index_bytes * 4 );
			len_quad_flat_uv   = md.nquad_flat_uv   * ( quad_size + md.uv_index_bytes * 4 );
			len_quad_smooth_uv = md.nquad_smooth_uv * ( quad_size + md.normal_index_bytes * 4 + md.uv_index_bytes * 4 );
			
			// read buffers
			
			currentOffset += init_vertices( currentOffset );
			currentOffset += init_normals( currentOffset );
			currentOffset += init_uvs( currentOffset );

			start_tri_flat 		= currentOffset; 
			start_tri_smooth    = start_tri_flat    + len_tri_flat;
			start_tri_flat_uv   = start_tri_smooth  + len_tri_smooth;
			start_tri_smooth_uv = start_tri_flat_uv + len_tri_flat_uv;
			
			start_quad_flat     = start_tri_smooth_uv + len_tri_smooth_uv;
			start_quad_smooth   = start_quad_flat     + len_quad_flat;
			start_quad_flat_uv  = start_quad_smooth   + len_quad_smooth;
			start_quad_smooth_uv= start_quad_flat_uv  +len_quad_flat_uv;

			// have to first process faces with uvs
			// so that face and uv indices match
			
			init_triangles_flat_uv( start_tri_flat_uv );
			init_triangles_smooth_uv( start_tri_smooth_uv );

			init_quads_flat_uv( start_quad_flat_uv );
			init_quads_smooth_uv( start_quad_smooth_uv );

			// now we can process untextured faces
			
			init_triangles_flat( start_tri_flat );
			init_triangles_smooth( start_tri_smooth );

			init_quads_flat( start_quad_flat );
			init_quads_smooth( start_quad_smooth );

			this.computeCentroids();
			this.computeFaceNormals();

			//var e = (new Date).getTime();

			//log( "binary data parse time: " + (e-s) + " ms" );

			function parseMetaData( data, offset ) {

				var metaData = {

					'signature'               :parseString( data, offset, 8 ),
					'header_bytes'            :parseUChar8( data, offset + 8 ),

					'vertex_coordinate_bytes' :parseUChar8( data, offset + 9 ),
					'normal_coordinate_bytes' :parseUChar8( data, offset + 10 ),
					'uv_coordinate_bytes'     :parseUChar8( data, offset + 11 ),

					'vertex_index_bytes'      :parseUChar8( data, offset + 12 ),
					'normal_index_bytes'      :parseUChar8( data, offset + 13 ),
					'uv_index_bytes'          :parseUChar8( data, offset + 14 ),
					'material_index_bytes'    :parseUChar8( data, offset + 15 ),

					'nvertices'    :parseUInt32( data, offset + 16 ),
					'nnormals'     :parseUInt32( data, offset + 16 + 4*1 ),
					'nuvs'         :parseUInt32( data, offset + 16 + 4*2 ),

					'ntri_flat'      :parseUInt32( data, offset + 16 + 4*3 ),
					'ntri_smooth'    :parseUInt32( data, offset + 16 + 4*4 ),
					'ntri_flat_uv'   :parseUInt32( data, offset + 16 + 4*5 ),
					'ntri_smooth_uv' :parseUInt32( data, offset + 16 + 4*6 ),

					'nquad_flat'      :parseUInt32( data, offset + 16 + 4*7 ),
					'nquad_smooth'    :parseUInt32( data, offset + 16 + 4*8 ),
					'nquad_flat_uv'   :parseUInt32( data, offset + 16 + 4*9 ),
					'nquad_smooth_uv' :parseUInt32( data, offset + 16 + 4*10 )

				};

				/*
				log( "signature: " + metaData.signature );

				log( "header_bytes: " + metaData.header_bytes );
				log( "vertex_coordinate_bytes: " + metaData.vertex_coordinate_bytes );
				log( "normal_coordinate_bytes: " + metaData.normal_coordinate_bytes );
				log( "uv_coordinate_bytes: " + metaData.uv_coordinate_bytes );

				log( "vertex_index_bytes: " + metaData.vertex_index_bytes );
				log( "normal_index_bytes: " + metaData.normal_index_bytes );
				log( "uv_index_bytes: " + metaData.uv_index_bytes );
				log( "material_index_bytes: " + metaData.material_index_bytes );

				log( "nvertices: " + metaData.nvertices );
				log( "nnormals: " + metaData.nnormals );
				log( "nuvs: " + metaData.nuvs );

				log( "ntri_flat: " + metaData.ntri_flat );
				log( "ntri_smooth: " + metaData.ntri_smooth );
				log( "ntri_flat_uv: " + metaData.ntri_flat_uv );
				log( "ntri_smooth_uv: " + metaData.ntri_smooth_uv );

				log( "nquad_flat: " + metaData.nquad_flat );
				log( "nquad_smooth: " + metaData.nquad_smooth );
				log( "nquad_flat_uv: " + metaData.nquad_flat_uv );
				log( "nquad_smooth_uv: " + metaData.nquad_smooth_uv );

				var total = metaData.header_bytes
						  + metaData.nvertices * metaData.vertex_coordinate_bytes * 3
						  + metaData.nnormals * metaData.normal_coordinate_bytes * 3
						  + metaData.nuvs * metaData.uv_coordinate_bytes * 2
						  + metaData.ntri_flat * ( metaData.vertex_index_bytes*3 + metaData.material_index_bytes )
						  + metaData.ntri_smooth * ( metaData.vertex_index_bytes*3 + metaData.material_index_bytes + metaData.normal_index_bytes*3 )
						  + metaData.ntri_flat_uv * ( metaData.vertex_index_bytes*3 + metaData.material_index_bytes + metaData.uv_index_bytes*3 )
						  + metaData.ntri_smooth_uv * ( metaData.vertex_index_bytes*3 + metaData.material_index_bytes + metaData.normal_index_bytes*3 + metaData.uv_index_bytes*3 )
						  + metaData.nquad_flat * ( metaData.vertex_index_bytes*4 + metaData.material_index_bytes )
						  + metaData.nquad_smooth * ( metaData.vertex_index_bytes*4 + metaData.material_index_bytes + metaData.normal_index_bytes*4 )
						  + metaData.nquad_flat_uv * ( metaData.vertex_index_bytes*4 + metaData.material_index_bytes + metaData.uv_index_bytes*4 )
						  + metaData.nquad_smooth_uv * ( metaData.vertex_index_bytes*4 + metaData.material_index_bytes + metaData.normal_index_bytes*4 + metaData.uv_index_bytes*4 );
				log( "total bytes: " + total );
				*/

				return metaData;

			}

			function parseString( data, offset, length ) {

				return data.substr( offset, length );

			}

			function parseFloat32( data, offset ) {

				var b3 = parseUChar8( data, offset ),
					b2 = parseUChar8( data, offset + 1 ),
					b1 = parseUChar8( data, offset + 2 ),
					b0 = parseUChar8( data, offset + 3 ),

					sign = 1 - ( 2 * ( b0 >> 7 ) ),
					exponent = ((( b0 << 1 ) & 0xff) | ( b1 >> 7 )) - 127,
					mantissa = (( b1 & 0x7f ) << 16) | (b2 << 8) | b3;

					if (mantissa == 0 && exponent == -127)
						return 0.0;

					return sign * ( 1 + mantissa * Math.pow( 2, -23 ) ) * Math.pow( 2, exponent );

			}

			function parseUInt32( data, offset ) {

				var b0 = parseUChar8( data, offset ),
					b1 = parseUChar8( data, offset + 1 ),
					b2 = parseUChar8( data, offset + 2 ),
					b3 = parseUChar8( data, offset + 3 );

				return (b3 << 24) + (b2 << 16) + (b1 << 8) + b0;
			}

			function parseUInt16( data, offset ) {

				var b0 = parseUChar8( data, offset ),
					b1 = parseUChar8( data, offset + 1 );

				return (b1 << 8) + b0;

			}

			function parseSChar8( data, offset ) {

				var b = parseUChar8( data, offset );
				return b > 127 ? b - 256 : b;

			}

			function parseUChar8( data, offset ) {

				return data.charCodeAt( offset ) & 0xff;
			}

			function init_vertices( start ) {

				var i, x, y, z, 
					stride = md.vertex_coordinate_bytes * 3,
					end = start + md.nvertices * stride;

				for( i = start; i < end; i += stride ) {

					x = parseFloat32( data, i );
					y = parseFloat32( data, i + md.vertex_coordinate_bytes );
					z = parseFloat32( data, i + md.vertex_coordinate_bytes*2 );

					THREE.LoaderOld.prototype.v( scope, x, y, z );

				}

				return md.nvertices * stride;

			}

			function init_normals( start ) {

				var i, x, y, z, 
					stride = md.normal_coordinate_bytes * 3,
					end = start + md.nnormals * stride;

				for( i = start; i < end; i += stride ) {

					x = parseSChar8( data, i );
					y = parseSChar8( data, i + md.normal_coordinate_bytes );
					z = parseSChar8( data, i + md.normal_coordinate_bytes*2 );

					normals.push( x/127, y/127, z/127 );

				}

				return md.nnormals * stride;

			}

			function init_uvs( start ) {

				var i, u, v, 
					stride = md.uv_coordinate_bytes * 2,
					end = start + md.nuvs * stride;

				for( i = start; i < end; i += stride ) {

					u = parseFloat32( data, i );
					v = parseFloat32( data, i + md.uv_coordinate_bytes );

					uvs.push( u, v );

				}
				
				return md.nuvs * stride;

			}			
			
			function add_tri( i ) {

				var a, b, c, m;

				a = parseUInt32( data, i );
				b = parseUInt32( data, i + tri_b );
				c = parseUInt32( data, i + tri_c );

				m = parseUInt16( data, i + tri_m );

				THREE.LoaderOld.prototype.f3( scope, a, b, c, m );

			}

			function add_tri_n( i ) {

				var a, b, c, m, na, nb, nc;

				a  = parseUInt32( data, i );
				b  = parseUInt32( data, i + tri_b );
				c  = parseUInt32( data, i + tri_c );

				m  = parseUInt16( data, i + tri_m );

				na = parseUInt32( data, i + tri_na );
				nb = parseUInt32( data, i + tri_nb );
				nc = parseUInt32( data, i + tri_nc );

				THREE.LoaderOld.prototype.f3n( scope, normals, a, b, c, m, na, nb, nc );

			}

			function add_quad( i ) {

				var a, b, c, d, m;

				a = parseUInt32( data, i );
				b = parseUInt32( data, i + quad_b );
				c = parseUInt32( data, i + quad_c );
				d = parseUInt32( data, i + quad_d );

				m = parseUInt16( data, i + quad_m );

				THREE.LoaderOld.prototype.f4( scope, a, b, c, d, m );

			}

			function add_quad_n( i ) {

				var a, b, c, d, m, na, nb, nc, nd;

				a  = parseUInt32( data, i );
				b  = parseUInt32( data, i + quad_b );
				c  = parseUInt32( data, i + quad_c );
				d  = parseUInt32( data, i + quad_d );

				m  = parseUInt16( data, i + quad_m );

				na = parseUInt32( data, i + quad_na );
				nb = parseUInt32( data, i + quad_nb );
				nc = parseUInt32( data, i + quad_nc );
				nd = parseUInt32( data, i + quad_nd );

				THREE.LoaderOld.prototype.f4n( scope, normals, a, b, c, d, m, na, nb, nc, nd );

			}

			function add_uv3( i ) {

				var uva, uvb, uvc, u1, u2, u3, v1, v2, v3;

				uva = parseUInt32( data, i );
				uvb = parseUInt32( data, i + tri_uvb );
				uvc = parseUInt32( data, i + tri_uvc );

				u1 = uvs[ uva*2 ];
				v1 = uvs[ uva*2 + 1 ];

				u2 = uvs[ uvb*2 ];
				v2 = uvs[ uvb*2 + 1 ];

				u3 = uvs[ uvc*2 ];
				v3 = uvs[ uvc*2 + 1 ];

				THREE.LoaderOld.prototype.uv3( scope.uvs, u1, v1, u2, v2, u3, v3 );

			}

			function add_uv4( i ) {

				var uva, uvb, uvc, uvd, u1, u2, u3, u4, v1, v2, v3, v4;

				uva = parseUInt32( data, i );
				uvb = parseUInt32( data, i + quad_uvb );
				uvc = parseUInt32( data, i + quad_uvc );
				uvd = parseUInt32( data, i + quad_uvd );

				u1 = uvs[ uva*2 ];
				v1 = uvs[ uva*2 + 1 ];

				u2 = uvs[ uvb*2 ];
				v2 = uvs[ uvb*2 + 1 ];

				u3 = uvs[ uvc*2 ];
				v3 = uvs[ uvc*2 + 1 ];

				u4 = uvs[ uvd*2 ];
				v4 = uvs[ uvd*2 + 1 ];

				THREE.LoaderOld.prototype.uv4( scope.uvs, u1, v1, u2, v2, u3, v3, u4, v4 );

			}

			function init_triangles_flat( start ) {

				var i, stride = md.vertex_index_bytes * 3 + md.material_index_bytes,
					end = start + md.ntri_flat * stride;

				for( i = start; i < end; i += stride ) {

					add_tri( i );

				}

				return end - start;

			}

			function init_triangles_flat_uv( start ) {

				var i, offset = md.vertex_index_bytes * 3 + md.material_index_bytes,
					stride = offset + md.uv_index_bytes * 3,
					end = start + md.ntri_flat_uv * stride;

				for( i = start; i < end; i += stride ) {

					add_tri( i );
					add_uv3( i + offset );

				}

				return end - start;

			}

			function init_triangles_smooth( start ) {

				var i, stride = md.vertex_index_bytes * 3 + md.material_index_bytes + md.normal_index_bytes * 3,
					end = start + md.ntri_smooth * stride;

				for( i = start; i < end; i += stride ) {

					add_tri_n( i );

				}

				return end - start;

			}

			function init_triangles_smooth_uv( start ) {

				var i, offset = md.vertex_index_bytes * 3 + md.material_index_bytes + md.normal_index_bytes * 3,
					stride = offset + md.uv_index_bytes * 3,
					end = start + md.ntri_smooth_uv * stride;

				for( i = start; i < end; i += stride ) {

					add_tri_n( i );
					add_uv3( i + offset );

				}

				return end - start;

			}

			function init_quads_flat( start ) {

				var i, stride = md.vertex_index_bytes * 4 + md.material_index_bytes,
					end = start + md.nquad_flat * stride;

				for( i = start; i < end; i += stride ) {

					add_quad( i );

				}

				return end - start;

			}

			function init_quads_flat_uv( start ) {

				var i, offset = md.vertex_index_bytes * 4 + md.material_index_bytes,
					stride = offset + md.uv_index_bytes * 4,
					end = start + md.nquad_flat_uv * stride;

				for( i = start; i < end; i += stride ) {

					add_quad( i );
					add_uv4( i + offset );

				}

				return end - start;

			}

			function init_quads_smooth( start ) {

				var i, stride = md.vertex_index_bytes * 4 + md.material_index_bytes + md.normal_index_bytes * 4,
					end = start + md.nquad_smooth * stride;

				for( i = start; i < end; i += stride ) {

					add_quad_n( i );
				}

				return end - start;

			}

			function init_quads_smooth_uv( start ) {

				var i, offset = md.vertex_index_bytes * 4 + md.material_index_bytes + md.normal_index_bytes * 4, 
					stride =  offset + md.uv_index_bytes * 4,
					end = start + md.nquad_smooth_uv * stride;

				for( i = start; i < end; i += stride ) {

					add_quad_n( i );
					add_uv4( i + offset );

				}

				return end - start;

			}

		}

		Model.prototype = new THREE.Geometry();
		Model.prototype.constructor = Model;

		callback( new Model( texture_path ) );

	},

	createModel: function ( data, callback, texture_path ) {

		var Model = function ( texture_path ) {

			var scope = this;

			THREE.Geometry.call( this );

			THREE.LoaderOld.prototype.init_materials( scope, data.materials, texture_path );

			init_vertices();
			init_faces();
			init_skin();

			this.computeCentroids();
			this.computeFaceNormals();

			function init_skin() {
				
				var i, l, x, y, z, w, a, b, c, d;

				if ( data.skinWeights ) {
					
					for( i = 0, l = data.skinWeights.length; i < l; i += 2 ) {

						x = data.skinWeights[ i     ];
						y = data.skinWeights[ i + 1 ];
						z = 0;
						w = 0;

						THREE.LoaderOld.prototype.sw( scope, x, y, z, w );

					}
					
				}
				
				if ( data.skinIndices ) {
					
					for( i = 0, l = data.skinIndices.length; i < l; i += 2 ) {

						a = data.skinIndices[ i     ];
						b = data.skinIndices[ i + 1 ];
						c = 0;
						d = 0;

						THREE.LoaderOld.prototype.si( scope, a, b, c, d );

					}
				
				}
				
				THREE.LoaderOld.prototype.bones( scope, data.bones );
				THREE.LoaderOld.prototype.animation( scope, data.animation );
				
			}
			
			function init_vertices() {

				var i, l, v, vl, x, y, z, r, g, b, srcVertices, dstVertices;

				// normal vertices

				for( i = 0, l = data.vertices.length; i < l; i += 3 ) {

					x = data.vertices[ i     ];
					y = data.vertices[ i + 1 ];
					z = data.vertices[ i + 2 ];

					THREE.LoaderOld.prototype.v( scope, x, y, z );

				}

				// vertex animation 

				if( data.morphTargets !== undefined ) {
					
					for( i = 0, l = data.morphTargets.length; i < l; i++ ) {
						
						scope.morphTargets[ i ] = {};
						scope.morphTargets[ i ].name = data.morphTargets[ i ].name;
						scope.morphTargets[ i ].vertices = [];
						
						dstVertices = scope.morphTargets[ i ].vertices;
						srcVertices = data.morphTargets [ i ].vertices;

						for( v = 0, vl = srcVertices.length; v < vl; v += 3 ) {

							dstVertices.push( new THREE.Vertex( new THREE.Vector3( srcVertices[ v ], srcVertices[ v + 1 ], srcVertices[ v + 2 ] )));

						}
						
					} 
					
				}

				
				if ( data.colors ) {
					
					for( i = 0, l = data.colors.length; i < l; i += 3 ) {
						
						r = data.colors[ i     ];
						g = data.colors[ i + 1 ];
						b = data.colors[ i + 2 ];

						THREE.LoaderOld.prototype.vc( scope, r, g, b );
					
					}
					
				}

			}

			function init_faces() {

				function add_tri( src, i ) {

					var a, b, c, m;

					a = src[ i ];
					b = src[ i + 1 ];
					c = src[ i + 2 ];

					m = src[ i + 3 ];

					THREE.LoaderOld.prototype.f3( scope, a, b, c, m );

				}

				function add_tri_n( src, i ) {

					var a, b, c, m, na, nb, nc;

					a  = src[ i ];
					b  = src[ i + 1 ];
					c  = src[ i + 2 ];

					m  = src[ i + 3 ];

					na = src[ i + 4 ];
					nb = src[ i + 5 ];
					nc = src[ i + 6 ];

					THREE.LoaderOld.prototype.f3n( scope, data.normals, a, b, c, m, na, nb, nc );

				}

				function add_quad( src, i ) {

					var a, b, c, d, m;

					a = src[ i ];
					b = src[ i + 1 ];
					c = src[ i + 2 ];
					d = src[ i + 3 ];

					m = src[ i + 4 ];

					THREE.LoaderOld.prototype.f4( scope, a, b, c, d, m );

				}

				function add_quad_n( src, i ) {

					var a, b, c, d, m, na, nb, nc, nd;

					a  = src[ i ];
					b  = src[ i + 1 ];
					c  = src[ i + 2 ];
					d  = src[ i + 3 ];

					m  = src[ i + 4 ];

					na = src[ i + 5 ];
					nb = src[ i + 6 ];
					nc = src[ i + 7 ];
					nd = src[ i + 8 ];

					THREE.LoaderOld.prototype.f4n( scope, data.normals, a, b, c, d, m, na, nb, nc, nd );

				}

				function add_uv3( src, i ) {

					var uva, uvb, uvc, u1, u2, u3, v1, v2, v3;

					uva = src[ i ];
					uvb = src[ i + 1 ];
					uvc = src[ i + 2 ];

					u1 = data.uvs[ uva * 2 ];
					v1 = data.uvs[ uva * 2 + 1 ];

					u2 = data.uvs[ uvb * 2 ];
					v2 = data.uvs[ uvb * 2 + 1 ];

					u3 = data.uvs[ uvc * 2 ];
					v3 = data.uvs[ uvc * 2 + 1 ];

					THREE.LoaderOld.prototype.uv3( scope.uvs, u1, v1, u2, v2, u3, v3 );
					
					if( data.uvs2 && data.uvs2.length ) {
						
						u1 = data.uvs2[ uva * 2 ];
						v1 = data.uvs2[ uva * 2 + 1 ];

						u2 = data.uvs2[ uvb * 2 ];
						v2 = data.uvs2[ uvb * 2 + 1 ];

						u3 = data.uvs2[ uvc * 2 ];
						v3 = data.uvs2[ uvc * 2 + 1 ];

						THREE.LoaderOld.prototype.uv3( scope.uvs2, u1, 1-v1, u2, 1-v2, u3, 1-v3 );
						
					}

				}

				function add_uv4( src, i ) {

					var uva, uvb, uvc, uvd, u1, u2, u3, u4, v1, v2, v3, v4;

					uva = src[ i ];
					uvb = src[ i + 1 ];
					uvc = src[ i + 2 ];
					uvd = src[ i + 3 ];

					u1 = data.uvs[ uva * 2 ];
					v1 = data.uvs[ uva * 2 + 1 ];

					u2 = data.uvs[ uvb * 2 ];
					v2 = data.uvs[ uvb * 2 + 1 ];

					u3 = data.uvs[ uvc * 2 ];
					v3 = data.uvs[ uvc * 2 + 1 ];

					u4 = data.uvs[ uvd * 2 ];
					v4 = data.uvs[ uvd * 2 + 1 ];

					THREE.LoaderOld.prototype.uv4( scope.uvs, u1, v1, u2, v2, u3, v3, u4, v4 );
					
					if( data.uvs2 ) {
						
						u1 = data.uvs2[ uva * 2 ];
						v1 = data.uvs2[ uva * 2 + 1 ];

						u2 = data.uvs2[ uvb * 2 ];
						v2 = data.uvs2[ uvb * 2 + 1 ];

						u3 = data.uvs2[ uvc * 2 ];
						v3 = data.uvs2[ uvc * 2 + 1 ];

						u4 = data.uvs2[ uvd * 2 ];
						v4 = data.uvs2[ uvd * 2 + 1 ];

						THREE.LoaderOld.prototype.uv4( scope.uvs2, u1, 1-v1, u2, 1-v2, u3, 1-v3, u4, 1-v4 );
						
					}

				}

				var i, l;
				
				// need to process first faces with uvs
				// as uvs are indexed by face indices
				
				for ( i = 0, l = data.trianglesUvs.length; i < l; i+= 7 ) {

					add_tri( data.trianglesUvs, i );
					add_uv3( data.trianglesUvs, i + 4 );

				}

				for ( i = 0, l = data.trianglesNormalsUvs.length; i < l; i += 10 ) {

					add_tri_n( data.trianglesNormalsUvs, i );
					add_uv3( data.trianglesNormalsUvs, i + 7 );

				}
				
				for ( i = 0, l = data.quadsUvs.length; i < l; i += 9 ) {

					add_quad( data.quadsUvs, i );
					add_uv4( data.quadsUvs, i + 5 );

				}
				
				for ( i = 0, l = data.quadsNormalsUvs.length; i < l; i += 13 ) {

					add_quad_n( data.quadsNormalsUvs, i );
					add_uv4( data.quadsNormalsUvs, i + 9 );

				}
				
				// now can process untextured faces
				
				for ( i = 0, l = data.triangles.length; i < l; i += 4 ) {

					add_tri( data.triangles, i );

				}

				for ( i = 0, l = data.trianglesNormals.length; i < l; i += 7 ) {

					add_tri_n( data.trianglesNormals, i );

				}

				for ( i = 0, l = data.quads.length; i < l; i += 5 ) {

					add_quad( data.quads, i );

				}

				for ( i = 0, l = data.quadsNormals.length; i < l; i += 9 ) {

					add_quad_n( data.quadsNormals, i );

				}

			}

		}

		Model.prototype = new THREE.Geometry();
		Model.prototype.constructor = Model;

		callback( new Model( texture_path ) );

	},

	bones: function( scope, bones ) {

		scope.bones = bones;

	},
	
	animation: function( scope, animation ) {
		
		scope.animation = animation;

	},
	
	si: function( scope, a, b, c, d ) {

		scope.skinIndices.push( new THREE.Vector4( a, b, c, d ) );

	},

	sw: function( scope, x, y, z, w ) {

		scope.skinWeights.push( new THREE.Vector4( x, y, z, w ) );

	},
	
	v: function( scope, x, y, z ) {

		scope.vertices.push( new THREE.Vertex( new THREE.Vector3( x, y, z ) ) );

	},



	vc: function( scope, r, g, b ) {

		var color = new THREE.Color( 0xffffff );
		color.setRGB( r, g, b );
		scope.colors.push( color );

	},

	f3: function( scope, a, b, c, mi ) {

		var material = scope.materials[ mi ];
		scope.faces.push( new THREE.Face3( a, b, c, null, material ) );

	},

	f4: function( scope, a, b, c, d, mi ) {

		var material = scope.materials[ mi ];
		scope.faces.push( new THREE.Face4( a, b, c, d, null, material ) );

	},

	f3n: function( scope, normals, a, b, c, mi, na, nb, nc ) {

		var material = scope.materials[ mi ],
			nax = normals[ na*3     ],
			nay = normals[ na*3 + 1 ],
			naz = normals[ na*3 + 2 ],

			nbx = normals[ nb*3     ],
			nby = normals[ nb*3 + 1 ],
			nbz = normals[ nb*3 + 2 ],

			ncx = normals[ nc*3     ],
			ncy = normals[ nc*3 + 1 ],
			ncz = normals[ nc*3 + 2 ];

		scope.faces.push( new THREE.Face3( a, b, c, 
						  [new THREE.Vector3( nax, nay, naz ), 
						   new THREE.Vector3( nbx, nby, nbz ), 
						   new THREE.Vector3( ncx, ncy, ncz )], 
						  material ) );

	},

	f4n: function( scope, normals, a, b, c, d, mi, na, nb, nc, nd ) {

		var material = scope.materials[ mi ],
			nax = normals[ na*3     ],
			nay = normals[ na*3 + 1 ],
			naz = normals[ na*3 + 2 ],

			nbx = normals[ nb*3     ],
			nby = normals[ nb*3 + 1 ],
			nbz = normals[ nb*3 + 2 ],

			ncx = normals[ nc*3     ],
			ncy = normals[ nc*3 + 1 ],
			ncz = normals[ nc*3 + 2 ],

			ndx = normals[ nd*3     ],
			ndy = normals[ nd*3 + 1 ],
			ndz = normals[ nd*3 + 2 ];

		scope.faces.push( new THREE.Face4( a, b, c, d,
						  [new THREE.Vector3( nax, nay, naz ), 
						   new THREE.Vector3( nbx, nby, nbz ), 
						   new THREE.Vector3( ncx, ncy, ncz ), 
						   new THREE.Vector3( ndx, ndy, ndz )], 
						  material ) );

	},

	uv3: function( where, u1, v1, u2, v2, u3, v3 ) {

		var uv = [];
		uv.push( new THREE.UV( u1, v1 ) );
		uv.push( new THREE.UV( u2, v2 ) );
		uv.push( new THREE.UV( u3, v3 ) );
		where.push( uv );

	},

	uv4: function( where, u1, v1, u2, v2, u3, v3, u4, v4 ) {

		var uv = [];
		uv.push( new THREE.UV( u1, v1 ) );
		uv.push( new THREE.UV( u2, v2 ) );
		uv.push( new THREE.UV( u3, v3 ) );
		uv.push( new THREE.UV( u4, v4 ) );
		where.push( uv );

	},

	init_materials: function( scope, materials, texture_path ) {

		scope.materials = [];

		for ( var i = 0; i < materials.length; ++i ) {

			scope.materials[i] = [ THREE.LoaderOld.prototype.createMaterial( materials[i], texture_path ) ];

		}

	},

	createMaterial: function ( m, texture_path ) {

		function is_pow2( n ) {

			var l = Math.log(n) / Math.LN2;
			return Math.floor(l) == l;

		}

		function nearest_pow2( n ) {

			var l = Math.log(n) / Math.LN2;
			return Math.pow( 2, Math.round(l) );

		}

		function load_image( where, url ) {
			
			var image = new Image();
			
			image.onload = function () {

				if ( !is_pow2( this.width ) || !is_pow2( this.height ) ) {

					var w = nearest_pow2( this.width ),
						h = nearest_pow2( this.height );

					where.image.width = w;
					where.image.height = h;
					where.image.getContext("2d").drawImage( this, 0, 0, w, h );

				} else {

					where.image = this;

				}

				where.needsUpdate = true;

			};

			image.src = url;
			
		}
		
		var material, mtype, mpars, texture, color;

		// defaults
		
		mtype = "MeshLambertMaterial";
		mpars = { color: 0xeeeeee, opacity: 1.0, map: null, lightMap: null, vertexColors: m.vertexColors };
		
		// parameters from model file
		
		if ( m.shading ) {
			
			if ( m.shading == "Phong" ) mtype = "MeshPhongMaterial";
			
		}
		
		if ( m.mapDiffuse && texture_path ) {

			texture = document.createElement( 'canvas' );
			
			mpars.map = new THREE.Texture( texture );
			mpars.map.sourceFile = m.mapDiffuse;
			
			load_image( mpars.map, texture_path + "/" + m.mapDiffuse );

		} else if ( m.colorDiffuse ) {

			color = ( m.colorDiffuse[0] * 255 << 16 ) + ( m.colorDiffuse[1] * 255 << 8 ) + m.colorDiffuse[2] * 255;
			mpars.color = color;
			mpars.opacity =  m.transparency;

		} else if ( m.DbgColor ) {

			mpars.color = m.DbgColor;

		}

		if ( m.mapLightmap && texture_path ) {

			texture = document.createElement( 'canvas' );
			
			mpars.lightMap = new THREE.Texture( texture );
			mpars.lightMap.sourceFile = m.mapLightmap;
			
			load_image( mpars.lightMap, texture_path + "/" + m.mapLightmap );

		}
		
		material = new THREE[ mtype ]( mpars );

		return material;

	},
	
	extractUrlbase: function( url ) {
		
		var chunks = url.split( "/" );
		chunks.pop();
		return chunks.join( "/" );
		
	}

};
