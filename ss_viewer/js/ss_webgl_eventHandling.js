//*******************************
//EVENT CALLBACKS
//*******************************

//rotate Function
function doRotate(rx,ry){//dom - no reference to current camera position in this function! i think this is part of the problem. function relies on mouse position being right?
	
	
	theta = - ( ( rx - onMouseDownPosition.x ) * 0.5 ) + onMouseDownTheta;
	theta = Math.min( 120, Math.max( -120, theta ) );
	phi = ( ( ry - onMouseDownPosition.y ) * 0.5 ) + onMouseDownPhi;
	phi = Math.min( 90, Math.max( -90, phi ) );

	cameraPosition(theta,phi,radius);
}

//mouseMove Callback
function onDocumentMouseMove(event) {
	
	//Handle Left Mouse as Rotate
	if (isMouseDown == true && mouseType== "left" ){	
		
		lastFrameX = currentX;
		lastFrameY = currentY;
		currentX = event.clientX;
		currentY = event.clientY;
		
		doRotate(currentX,currentY);		
	}
	
	
	//Handle Right Mouse as Zoom
	if(isMouseDown == true && mouseType== "right" ){
		currentX = event.clientX;
		currentY = event.clientY;
		
		radius =  ( ( event.clientY - onMouseDownPosition.y ) * (bbox/442) ) + onMouseDownRadius;
		radius = Math.min( (bbox*5), Math.max( (bbox/2), radius ) );
		cameraPosition(theta,phi,radius);
	}
	
	//Handle Middle Mouse as Pan
	if(isMouseDown == true && mouseType== "middle" ){
		currentX = event.clientX;
		currentY = event.clientY;
		
		dX = ((event.clientX - lastFrameX)*(bbox/600));
		dY = ((event.clientY - lastFrameY)*(bbox/600));
		dY = -dY;
							
		camXDelta = camXVector.clone()
		camXDelta.multiplyScalar(dX)
		
		camYDelta = camYVector.clone()
		camYDelta.multiplyScalar(dY)
	
		vectorTemp.add(camXDelta , camYDelta);
		
		camera.target.position.x -= vectorTemp.x;
		camera.target.position.y -= vectorTemp.y;
		camera.target.position.z -= vectorTemp.z;
		
		camera.position.x -= vectorTemp.x;
		camera.position.y -= vectorTemp.y;
		camera.position.z -= vectorTemp.z;
		
		//log("cam"+camera.position.toString() + "    target" + camera.target.position.toString());
		
		camera.updateMatrix();
		
		lastFrameX = currentX;
		lastFrameY = currentY;
	}
	
	
}

//mouseDown Callback
function onDocumentMouseDown(event) {
	
	isMouseDown = true;
	onMouseDownTheta = theta;
	onMouseDownPhi = phi;
	onMouseDownRadius = radius;
	
	onMouseDownPosition.x = event.clientX;
	onMouseDownPosition.y = event.clientY;
	
	doDecay=false;
	lastFrameX = currentX;//these 2 lines needed to be here! on click down, reset your mouse position, not just when dragging!
	lastFrameY = currentY;
	
	camNormalVector = camera.position.clone();
	camNormalVector = camNormalVector.normalize()
	
	camXVector.x = Math.cos( theta * Math.PI / 180);
	camXVector.y = 0;
	camXVector.z = Math.sin( theta * Math.PI / 180  + Math.PI);

	
	camYVector.cross(camNormalVector,camXVector);
	
	//Left - make sure there is nothing else pressed
	if (event.button == 0){
		mouseType = "left";
	}
	//Middle
	if (event.button == 1){
		mouseType = "middle";
	}
	//Right
	if (event.button == 2){
		mouseType = "right";
	}
}

//mouseUp Callback
function onDocumentMouseUp(event) {
	//letting go of any mouse lets go of all
	isMouseDown = false;
	
	doDecay=true;
	
	escapeVelocity.x = mouseVelocityX;
	escapeVelocity.y = mouseVelocityY;
	
	if( escapeVelocity.x == 0 && escapeVelocity.y == 0){//this if statement too, it keeps decay from ever happening if mouse hasnt moved, and resets last frame coords. 
		doDecay = false;
		lastFrameX = currentX;
		lastFrameY = currentY;
	}
	
	tempX = currentX;
	tempY = currentY;
	
	decayVelocity = escapeVelocity.clone();	
	decayTime = 0;
	
}

//Reset Click Handling
function toggleReset() {
	log("ResetView");		
	radius = bbox * 2;
	
	a = (- (onMouseDownTheta *-2 )+ onMouseDownPosition.x);
	b = - (onMouseDownPhi *2 )+ onMouseDownPosition.y;

	doRotate(a,b);
	
	
	//dom and greg suck at math and logixxx too
	//theta = - ( ( rx - onMouseDownPosition.x ) * 0.5 ) + onMouseDownTheta;
	//phi = ( ( ry - onMouseDownPosition.y ) * 0.5 ) + onMouseDownPhi;
	//cameraPosition (0,0,radius)
}

//click Shader Handling
function toggleChangeShader() {
	
	shaderNum = shaderNum +1;
	if (shaderNum == 3){
		shaderNum = 0;
	}
	
	if (shaderNum == 0){
		log("Shader 0: Texture Only  Default");
		scene.removeLight( directionalLightLeft );
		scene.removeLight( directionalLightRight );
		mesh.materials[0] = myMaterials[0].material;
	}
	
	if (shaderNum == 8){
		log("Shader 1: Texture plus 3d Lights");
		mesh.materials[0] = myMaterials[0].material;
		scene.addLight( directionalLightLeft );
		scene.addLight( directionalLightRight );
		
	}
	
	if (shaderNum == 1){
		log("Shader 2: Wire");
		scene.addLight( directionalLightLeft );
		scene.addLight( directionalLightRight );
		mesh.materials[0] = myMaterials[1].material;
	}
	
	if (shaderNum == 2){
		log("Shader 3: Smooth");
		mesh.materials[0] = myMaterials[2].material;
	}
}

//click enable AutoZoom algorithm
function toggleAutoZoom() {
	log("AutoZoom");	
}

//click moveScale
function toggleMoveScale() {
	log("MoveScale");				
}

//click Toggle AutoRotate
function toggleAutoRotate() {
	log("AutoRotate");	
	if (autoRotateEnabled == true){
		autoRotateEnabled = false;
		mesh.rotation.y = 0;
		doDecay=false;
	}
	else{
		autoRotateEnabled = true;
	}
}

//click moveScale
function toggleTextureViewer() {
	log("Texture Viewer");				
}

//click moveScale
function toggleScreenshot() {
	log("Screenshot");	
}