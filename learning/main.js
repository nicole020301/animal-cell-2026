import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { OculusHandModel } from 'three/addons/webxr/OculusHandModel.js';
import { OculusHandPointerModel } from 'three/addons/webxr/OculusHandPointerModel.js';
import { createText } from 'three/addons/webxr/Text2D.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module';
import { World, System, Component, TagComponent, Types } from 'three/addons/libs/ecsy.module.js';


// Define classes for ECS-based components and systems
class Object3D extends Component { }
Object3D.schema = { object: { type: Types.Ref } };

class Button extends Component { }
Button.schema = {
    currState: { type: Types.String, default: 'none' },
    prevState: { type: Types.String, default: 'none' },
    action: { type: Types.Ref, default: () => { } }
};

// Define systems for handling buttons and interactions
class ButtonSystem extends System {
    execute() {
        this.queries.buttons.results.forEach(entity => {
            const buttonMesh = entity.getComponent(Object3D).object;

            // Check if originalscale is not set and set it if it's undefined
            if (!buttonMesh.userData.originalscale) {
                buttonMesh.userData.originalscale = buttonMesh.scale.clone();
            }

            const button = entity.getMutableComponent(Button);
            const originalscale = buttonMesh.userData.originalscale.clone();
            const { x, y, z } = originalscale;

            if (button.currState === 'none') {
                // Reset scale here if needed
            } else if (button.currState === 'pressed' && button.prevState !== 'pressed') {
                button.action();  // Execute button action
            }

            button.prevState = button.currState;
            button.currState = 'none';
        });
    }
}

ButtonSystem.queries = { buttons: { components: [Button] } };

// Define components and systems for hand ray interactions, calibration, etc.
class Intersectable extends TagComponent { }
class HandRaySystem extends System {
    init(attributes) {
        this.handPointers = attributes.handPointers;
        this.pcEntity = attributes.pcEntity;
        this.world = attributes.world;
    }

    execute() {
        this.handPointers.forEach(hp => {
            let distance = null;
            let intersectingEntity = null;
            this.queries.intersectable.results.forEach(entity => {
                const object = entity.getComponent(Object3D).object;
                const intersections = hp.intersectObject(object, false);
                if (intersections && intersections.length > 0) {
                    if (distance === null || intersections[0].distance < distance) {
                        distance = intersections[0].distance;
                        intersectingEntity = entity;
                    }
                }
            });

            if (distance) {
                hp.setCursor(distance);
                if (intersectingEntity.hasComponent(Button)) {
                    const button = intersectingEntity.getMutableComponent(Button);
                    if (hp.isPinched()) {
                        button.currState = 'pressed';
                    } else if (button.currState !== 'pressed') {
                        button.currState = 'hovered';
                    }
                }
            } else {
                hp.setCursor(1.5);
            }
        });
    }
}

HandRaySystem.queries = { intersectable: { components: [Intersectable] } };

class Rotating extends TagComponent { }

class RotatingSystem extends System {

	execute( delta/*, time*/ ) {

		this.queries.rotatingObjects.results.forEach( entity => {

			const object = entity.getComponent( Object3D ).object;
			object.rotation.x += 0.4 * delta;
			object.rotation.y += 0.4 * delta;

		} );

	}

}

RotatingSystem.queries = {
	rotatingObjects: {
		components: [ Rotating ]
	}
};

class HandsInstructionText extends TagComponent { }

class InstructionSystem extends System {

	init( attributes ) {

		this.controllers = attributes.controllers;

	}

	execute( /* delta, time */ ) {

		let visible = false;
		this.controllers.forEach( controller => {

			if ( controller.visible ) {

				visible = true;

			}

		} );

		this.queries.instructionTexts.results.forEach( entity => {

			const object = entity.getComponent( Object3D ).object;
			object.visible = visible;

		} );

	}

}

InstructionSystem.queries = {
	instructionTexts: {
		components: [ HandsInstructionText ]
	}
};

class OffsetFromCamera extends Component { }

OffsetFromCamera.schema = {
	x: { type: Types.Number, default: 0 },
	y: { type: Types.Number, default: 0 },
	z: { type: Types.Number, default: 0 },
};

class NeedCalibration extends TagComponent { }

class CalibrationSystem extends System {

	init( attributes ) {

		this.camera = attributes.camera;
		this.renderer = attributes.renderer;

	}

	execute( /* delta, time */ ) {

		this.queries.needCalibration.results.forEach( entity => {

			if ( this.renderer.xr.getSession() ) {

				const offset = entity.getComponent( OffsetFromCamera );
				const object = entity.getComponent( Object3D ).object;
				const xrCamera = this.renderer.xr.getCamera();
				object.position.x = xrCamera.position.x + offset.x;
				object.position.y = xrCamera.position.y + offset.y;
				object.position.z = xrCamera.position.z + offset.z;
				entity.removeComponent( NeedCalibration );

			}

		} );

	}

}

CalibrationSystem.queries = {
	needCalibration: {
		components: [ NeedCalibration ]
	}
};

// Scene and animation setup
let world = new World();
let camera, scene, renderer, clock;
clock = new THREE.Clock();

init();
animate();

function makeButtonMesh( x, y, z, color ) {

	const geometry = new THREE.BoxGeometry( x, y, z );
	const material = new THREE.MeshPhongMaterial( { color: color } );
	const buttonMesh = new THREE.Mesh( geometry, material );
	buttonMesh.castShadow = true;
	buttonMesh.receiveShadow = true;
	return buttonMesh;

}

//transparent mode
function makeTransparentExcept(meshToKeepVisible) {
    scene.traverse(function(child) {
        if (child.isMesh && child !== meshToKeepVisible) {
            child.material.transparent = true;
            child.material.opacity = 0.1; // Example opacity
        } else if (child === meshToKeepVisible) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
        }
    });
}

//opaque mode
let opaque =0;
function makeAllMeshesOpaque() {
    opaque = 1;
    console.log("Opaque Mode");
    scene.traverse(function(child) {
        if (child.isMesh) {
            child.material.transparent = false;
            child.material.opacity = 1.0; // Reset opacity to full
        }
    });
}



// Main initialization function
function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.set(0, 1.2, 0.3);

    scene.add(new THREE.HemisphereLight(0xcccccc, 0x999999, 3));

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(1, 6, 3);
    light.castShadow = true;
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    renderer.xr.cameraAutoUpdate = false;
    container.appendChild(renderer.domElement);

    const sessionInit = { requiredFeatures: ['hand-tracking'] };
    document.body.appendChild(XRButton.createButton(renderer, sessionInit));

    const controller1 = renderer.xr.getController(0);
    scene.add(controller1);

    const controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();

    // Hand 1
    const controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    const hand1 = renderer.xr.getHand(0);
    hand1.add(new OculusHandModel(hand1));
    const handPointer1 = new OculusHandPointerModel(hand1, controller1);
    hand1.add(handPointer1);

    scene.add(hand1);

    // Hand 2
    const controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    const hand2 = renderer.xr.getHand(1);
    hand2.add(new OculusHandModel(hand2));
    const handPointer2 = new OculusHandPointerModel(hand2, controller2);
    hand2.add(handPointer2);
    scene.add(hand2);

    // Register components
    world.registerComponent(Object3D);
    world.registerComponent(Button);
    world.registerComponent(Intersectable);
    world.registerSystem(ButtonSystem);
    world.registerSystem(HandRaySystem, { handPointers: [] });

    // Load models
    loadGLTFModel('gltf/cilia.glb', 0.335, { x: 0, y: -1.1145, z: -1 });
    loadGLTFModel('gltf/centriole.glb', 0.216, { x: -0.14, y: -1.1, z: -1 });
    loadGLTFModel('gltf/cytoplasm.glb', 0.319, { x: 0, y: -1.15, z: -1 });
    loadGLTFModel('gltf/golgi1.glb', 0.235, { x: 0, y: -1.13, z: -0.96 });
    loadGLTFModel('gltf/golgi2.glb', 0.24, { x: 0.005, y: -1.14, z: -0.989 });
    loadGLTFModel('gltf/lyso1.glb', 0.205, { x: 0, y: -1.12, z: -1 });
    loadGLTFModel('gltf/lyso2.glb', 0.157, { x: -0.06, y: -1.12, z: -1 });
    loadGLTFModel('gltf/microfil1.glb', 0.66, { x: 0, y: -1.15, z: -1 });
    loadGLTFModel('gltf/microfil2.glb', 0.23, { x: 0, y: -1.12, z: -1 });
    loadGLTFModel('gltf/microtubules.glb', 0.24, { x: 0, y: -1.12, z: -1 });
    loadGLTFModel('gltf/mitochondria.glb', 0.245, { x: 0, y: -1.12, z: -0.991 });
    loadGLTFModel('gltf/nucleus1.glb', 0.24, { x: 0, y: -1.15, z: -1 });
    loadGLTFModel('gltf/nucleus2.glb', 0.24, { x: 0, y: -1.15, z: -1 });
    loadGLTFModel('gltf/nucleus3.glb', 0.24, { x: 0, y: -1.15, z: -1 });
    loadGLTFModel('gltf/perox1.glb', 0.115, { x: -0.015, y: -1.12, z: -0.965 });
    loadGLTFModel('gltf/perox2.glb', 0.0135, { x: 0, y: -1.12, z: -1.05 });
    loadGLTFModel('gltf/plasmaMembrane.glb', 0.244, { x: 0, y: -1.082, z: -1 });
    loadGLTFModel('gltf/ribosome1.glb', 0.235, { x: 0, y: -1.125, z: -1 });
    loadGLTFModel('gltf/ribosome2.glb', 0.235, { x: 0, y: -1.125, z: -1 });
    loadGLTFModel('gltf/roughER.glb', 0.238, { x: 0, y: -1.12, z: -0.97 });
    loadGLTFModel('gltf/smoothER.glb', 0.242, { x: 0, y: -1.13, z: -1});
    loadGLTFModel('gltf/vacuole1.glb', 0.126, { x: 0, y: -1.12, z: -1 });
    loadGLTFModel('gltf/vacuole2.glb', 0.11, { x: 0.05, y: -1.12, z: -0.98 });
}

// Function to load GLTF models
function loadGLTFModel(url, scale, position) {
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    gltfLoader.load(
        url,
        function (gltf) {
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    // Apply the provided scale
                    child.scale.set(scale, scale, scale);

                    // Apply the provided position
                    child.position.set(position.x, position.y, position.z);

                    scene.add(child);

                    // Action when the model is clicked
                    const modelAction = function () {
                        makeTransparentExcept(child);  // Keep selected model visible
                    };

                    const modelEntity = world.createEntity();
                    modelEntity.addComponent(Intersectable);  // Add the Intersectable component
                    modelEntity.addComponent(Object3D, { object: child });
                    modelEntity.addComponent(Button, { action: modelAction });
                }
            });

            // If the model contains animations, play them
            if (gltf.animations && gltf.animations.length) {
                const mixer = new THREE.AnimationMixer(gltf.scene);
                gltf.animations.forEach((clip) => {
                    mixer.clipAction(clip).play();
                });

                function animate() {
                    mixer.update(clock.getDelta());
                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                }
                animate();
            }
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error occurred while loading the GLTF model:', error);
        }
    );
}



// Animation loop
function animate() {
    renderer.setAnimationLoop(render);
}

// Render function
function render() {
    const delta = clock.getDelta();
    renderer.xr.updateCamera(camera);
    world.execute(delta, clock.elapsedTime);
    renderer.render(scene, camera);
}

// Window resize handler
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    // Check if the XR session is active
    if (renderer.xr.isPresenting) {
        return;  // Don't resize the renderer while VR is active
    }

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
