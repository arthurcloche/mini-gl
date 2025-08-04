1. Scene graph : Naming is still off

2. Preview panel : pause / reset are still not working. The sizing of the canvas is still off. 

3. Node graph : still no render with a single node in the graph, i can see a dark blue square, then it's goes black. Investigate. The output is not working correctly, i cannot visualize each node individually when i had multiple shader nodes.

4. Properties panel : when adding a uniform or a texture, shouldn't jump to the documentation panel.

5. Settings panel : the 'resolution' is not working. We will change this, instead of size we will add ratios
1:1, 2:1, 4:3, 8:5, 16:9. Then we will size the canvas to fit inside the preview panel according to this ratio, make sure to update the resolution uniforms accordingly.