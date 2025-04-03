import { createApp, ref, onMounted, onUnmounted, computed } from 'vue';

const api = window.overlay2API;

const app = createApp({
    setup() {
        const hits = ref([]);
        let hitCounter = 0;
        const isEditing = ref(false);
        const animationStyle = ref('floatUp'); // Default animation style
        
        // Variables for manual window dragging
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        
        // Function to generate a random number within a range
        const randomInRange = (min, max) => Math.random() * (max - min) + min;
        
        // Function to generate a random spread factor (-1 to 1) for horizontal movement
        const getRandomSpreadFactor = () => Math.random() * 2 - 1; // -1 to 1

        // Generate a random color for critical hits (varying shades of yellow/orange/red)
        const getHitColor = (value) => {
            // Base threshold for what's considered a "big hit"
            // This could be made dynamic based on the average/max hit observed
            const bigHitThreshold = 50;
            const critHitThreshold = 100;
            
            if (value >= critHitThreshold) {
                return '#FF5500'; // Orange-red for critical hits
            } else if (value >= bigHitThreshold) {
                return '#FFDD00'; // Yellow-gold for big hits
            }
            return '#FFFFFF'; // White for normal hits
        };
        
        // Calculate font size based on hit value
        const getHitSize = (value) => {
            const baseSize = 24;
            const bigHitThreshold = 50;
            const critHitThreshold = 100;
            
            if (value >= critHitThreshold) {
                return `${baseSize * 1.5}px`; // 50% larger for crits
            } else if (value >= bigHitThreshold) {
                return `${baseSize * 1.2}px`; // 20% larger for big hits
            }
            return `${baseSize}px`;
        };

        const handleNewHit = (hitValue) => {
            if (isEditing.value) return; 

            const currentStyle = animationStyle.value;
            let startX = 50; // Default to center horizontally
            let startY;

            // Determine starting Y position based on animation type
            if (currentStyle.includes('Up') || currentStyle.includes('Bounce')) { // Bounce implies Up currently
                startY = 80; // Start near the bottom for upward animations
            } else if (currentStyle.includes('Down')) {
                startY = 20; // Start near the top for downward animations
            } else { // Pulse, Spin, etc.
                startY = 50; // Start in the middle for non-directional animations
            }
            
            // Slight randomization around the start X/Y for less overlap (optional)
            startX += randomInRange(-5, 5); 
            startY += randomInRange(-3, 3); 

            const newHit = {
                id: hitCounter++,
                value: hitValue,
                x: startX, // NEW: Calculated start X
                y: startY, // NEW: Calculated start Y
                color: getHitColor(hitValue),
                fontSize: getHitSize(hitValue),
                spreadFactor: getRandomSpreadFactor(), // Used by spread animations
                animClass: `animation-${currentStyle}` // Use the determined style
            };
            hits.value.push(newHit);

            // Remove the hit after animation (matching animation duration)
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

        // Handler for animation style changes from main process
        const handleAnimationStyleChange = (style) => {
            console.log('[Overlay 2] Animation style set to:', style);
            animationStyle.value = style;
        };

        onMounted(() => {
            if (!api) {
                console.error('Overlay 2: preload API not found!');
                return;
            }
            api.onNewHit(handleNewHit);
            api.onSetEditMode(handleSetEditMode);
            
            // Register listener for animation style changes
            api.onAnimationStyleChange(handleAnimationStyleChange);
            
            // Get current animation style from main process
            api.getAnimationStyle().then(style => {
                if (style) {
                    animationStyle.value = style;
                    console.log('[Overlay 2] Initial animation style:', style);
                }
            }).catch(err => {
                console.error('[Overlay 2] Error getting animation style:', err);
            });
        });

        onUnmounted(() => {
            if (!api) return;
            api.removeAllListeners('new-hit');
            api.removeAllListeners('set-edit-mode');
            api.removeAllListeners('animation-style-change');
            
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
            isEditing,
            formatNumber
        };
    },
    template: `
        <div id="overlay2-container" :class="{ 'editing': isEditing }">
            <transition-group name="hit-fade" tag="div">
                <div v-for="hit in hits" :key="hit.id" 
                     class="floating-hit"
                     :class="hit.animClass"
                     :style="{ 
                         left: hit.x + '%', 
                         top: hit.y + '%',
                         color: hit.color,
                         fontSize: hit.fontSize,
                         '--spread-factor': hit.spreadFactor
                     }">
                    {{ formatNumber(hit.value) }}
                </div>
            </transition-group>
        </div>
    `
});

app.mount('#app');

console.log('Overlay 2 script loaded.'); 