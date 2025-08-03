1. Scene graph : This is great. 

2. Node palette : Let's hide the mininodes for now.

3. Preview : This is great. 

4. Node Graph : Way better. We still have a couple issues with the nodes properties. A texture or a video node shouldn't have an input or uniforms but a textbox to add a url to an image or a video. It should also have some options for sizing. It should also have the advanced tab. Same for the video node.
The canvas node should have the sizing options, with a button to match the current size of the webgl canvas, the advanced tab. No uniforms or inputs. A canvas should also have some code that can be opened in the shader editor tab, but with the setup for a webcanvas. MiniGL makes that easy as it can take a callback when creating the node and has an update((ctx,width,height,frame)=>{...canvas stuff}) function to update the canvas. Add a button to open the canvas code in the property panel for a canvas node.

Can we slightly color code the nodes, maybe only the title and the dots should be enough to differenciate them.

5. Properties panel : Great.

6. Settings / Export panel : Great. We will certainly add a 'JSON' button to export the node graph as a JSON file to be re-used outside of the app, but we will figure this out later, just add the button for now.