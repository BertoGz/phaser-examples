let camPos = { x: 0, y: 0 };
export class MotionBlurFX extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  constructor(game) {
    super({
      game,
      fragShader: `
        #define SHADER_NAME MotionBlurFX

        precision mediump float;
        
        uniform vec2 resolution;
        uniform float time; // Time variable for animation
        uniform vec2 cameraPosition; // Camera position
        
        // The texture to sample from
        uniform sampler2D uSampler;
        
        void main()
        {
            // Normalize the coordinates to range [0, 1]
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            
            // Calculate displacement based on camera movement
            vec2 displacement = cameraPosition - uv;
        
            // Apply motion blur effect by sampling previous frames
            vec4 previousFrameColor = texture2D(uSampler, uv - displacement * 0.5); // Adjust the blur intensity by changing the coefficient (0.5)
        
            // Output the result
            gl_FragColor = gl_FragColor;
        }
        
        `,
    });
  }

  onPreRender() {
    this.set2f("resolution", this.renderer.width, this.renderer.height);
    console.log(this.renderer.width, this.renderer.height);
    this.set1i("time", Date.now());
    // this.set2f("cameraPosition", camPos.x, camPos.y);
  }
  execute(x, y) {
    camPos = { x, y };
  }
}
