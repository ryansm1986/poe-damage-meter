import { createApp, ref, onMounted, onUnmounted } from 'vue';

const api = window.overlay2API;

const app = createApp({
    setup() {
        const hits = ref([]);
        let hitCounter = 0;
        const isEditing = ref(false); // Add editing state
        
        // Variables for manual window dragging
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        const handleNewHit = (hitValue) => {
            if (isEditing.value) return; 

            const newHit = {
                id: hitCounter++,
                value: hitValue,
                x: 50, 
                y: 50, 
            };
            hits.value.push(newHit);

            // Remove the hit after animation (e.g., 2 seconds)
            setTimeout(() => {
                hits.value = hits.value.filter(h => h.id !== newHit.id);
            }, 2000); 
        };

        const handleSetEditMode = (editingStatus) => {
            console.log('[Overlay 2] Edit mode set to:', editingStatus);
            isEditing.value = editingStatus;
            document.body.classList.toggle('edit-mode', editingStatus);
            
            // Setup or remove manual dragging handlers
            if (editingStatus) {
                document.addEventListener('mousedown', handleMouseDown);
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            } else {
                document.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
        
        // Manual window dragging handlers
        const handleMouseDown = (e) => {
            if (isEditing.value) {
                isDragging = true;
                dragStartX = e.screenX;
                dragStartY = e.screenY;
            }
        };
        
        const handleMouseMove = (e) => {
            if (isDragging && isEditing.value) {
                const deltaX = e.screenX - dragStartX;
                const deltaY = e.screenY - dragStartY;
                if (deltaX !== 0 || deltaY !== 0) {
                    api.moveWindow(deltaX, deltaY);
                    dragStartX = e.screenX;
                    dragStartY = e.screenY;
                }
            }
        };
        
        const handleMouseUp = () => {
            isDragging = false;
        };

        onMounted(() => {
            if (!api) {
                console.error('Overlay 2: preload API not found!');
                return;
            }
            api.onNewHit(handleNewHit);
            api.onSetEditMode(handleSetEditMode); // Register listener
        });

        onUnmounted(() => {
            if (!api) return;
            api.removeAllListeners('new-hit');
            api.removeAllListeners('set-edit-mode'); // Clean up listener
            
            // Clean up manual dragging
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        });

        const formatNumber = (num) => {
             return num.toLocaleString();
        };

        return {
            hits,
            isEditing, // Expose state
            formatNumber
        };
    },
    template: `
        <div id="overlay2-container" :class="{ 'editing': isEditing }">
            <transition-group name="hit-fade" tag="div">
                <div v-for="hit in hits" :key="hit.id" class="floating-hit"
                     :style="{ left: hit.x + '%', top: hit.y + '%' }">
                    {{ formatNumber(hit.value) }}
                </div>
            </transition-group>
        </div>
    `
});

app.mount('#app');

console.log('Overlay 2 script loaded.'); 