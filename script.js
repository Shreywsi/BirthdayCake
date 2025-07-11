// Interactive Birthday Cake - JavaScript Implementation
// This script handles microphone input, audio analysis, flame control, and celebratory animations

class BirthdayCake {
    constructor() {
        // DOM elements
        this.flame = document.getElementById('flame');
        this.confettiContainer = document.getElementById('confetti-container');
        this.audioCanvas = document.getElementById('audioCanvas');
        this.audioCtx = this.audioCanvas.getContext('2d');
        this.intensityBar = document.getElementById('intensity-bar');
        this.flameMessage = document.getElementById('flame-message');
        
        // Audio analysis variables
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isListening = false;
        this.flameExtinguished = false;
        
        this.GENTLE_BLOW_THRESHOLD = 0.03;   // gentle blowing
        this.HARD_BLOW_THRESHOLD = 0.08;     // hard blowing
        this.EXTINGUISH_THRESHOLD = 0.30;    // easier to extinguish
        this.EXTINGUISH_DURATION = 3000;      // a bit less time required
        
        // Timing variables for flame extinguishing
        this.highVolumeStartTime = 0;
        this.isHighVolume = false;
        
        this.hasStartedMic = false;
        this.flameMessageAppearances = 0;
        this.flameMessageWasActive = false;
        // Initialize the application
        this.init();
    }
    
    init() {
        // Start microphone on first user click
        document.body.addEventListener('click', () => {
            if (!this.hasStartedMic) {
                this.hasStartedMic = true;
                // Hide the mic instruction message
                const micInstruction = document.getElementById('mic-instruction');
                if (micInstruction) {
                    micInstruction.classList.add('hide');
                    setTimeout(() => { micInstruction.style.display = 'none'; }, 500);
                }
                this.startMicrophone();
            }
        }, { once: true });
        
        // Set up audio canvas
        this.setupAudioCanvas();
        
        // Check for browser compatibility
        this.checkBrowserSupport();
    }
    
    /**
     * Check if the browser supports required Web Audio API features
     */
    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Your browser does not support microphone access. Please use a modern browser.');
            return false;
        }
        
        if (!window.AudioContext && !window.webkitAudioContext) {
            this.showError('Your browser does not support Web Audio API. Please use a modern browser.');
            return false;
        }
        
        return true;
    }
    
    /**
     * Set up the audio visualization canvas
     */
    setupAudioCanvas() {
        this.audioCanvas.width = this.audioCanvas.offsetWidth;
        this.audioCanvas.height = this.audioCanvas.offsetHeight;
    }
    
    /**
     * Toggle microphone on/off
     */
    async toggleMicrophone() {
        if (this.isListening) {
            this.stopMicrophone();
        } else {
            await this.startMicrophone();
        }
    }
    
    /**
     * Start microphone and begin audio analysis
     */
    async startMicrophone() {
        try {
            // Update UI to show loading state
            // this.startMicButton.textContent = '🎤 Starting...'; // Removed button
            // this.startMicButton.disabled = true; // Removed button
            // this.startMicButton.classList.add('loading'); // Removed button
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            // Initialize audio context and analyser
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Configure analyser for optimal blow detection
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // Connect audio nodes
            this.microphone.connect(this.analyser);
            
            // Create data array for frequency analysis
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            // Start listening
            this.isListening = true;
            this.startAudioAnalysis();
            
            // Update UI
            // this.startMicButton.textContent = '🎤 Stop Microphone'; // Removed button
            // this.startMicButton.disabled = false; // Removed button
            // this.startMicButton.classList.remove('loading'); // Removed button
            // this.micStatus.textContent = 'Microphone: Active'; // Removed button
            // this.micStatus.classList.add('active'); // Removed button
            // this.audioCanvas.classList.add('active'); // Removed button
            
            console.log('Microphone started successfully');
            
        } catch (error) {
            console.error('Error starting microphone:', error);
            this.showError('Could not access microphone. Please check permissions and try again.');
            this.resetMicrophoneUI();
        }
    }
    
    /**
     * Stop microphone and clean up resources
     */
    stopMicrophone() {
        if (this.microphone && this.microphone.mediaStream) {
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.isListening = false;
        this.isHighVolume = false;
        this.highVolumeStartTime = 0;
        
        // Reset flame to normal state
        this.resetFlame();
        
        // Update UI
        // this.startMicButton.textContent = '🎤 Start Microphone'; // Removed button
        // this.micStatus.textContent = 'Microphone: Disabled'; // Removed button
        // this.micStatus.classList.remove('active'); // Removed button
        // this.audioCanvas.classList.remove('active'); // Removed button
        
        console.log('Microphone stopped');
    }
    
    /**
     * Main audio analysis loop - analyzes microphone input and controls flame behavior
     */
    startAudioAnalysis() {
        if (!this.isListening) return;
        
        // Get frequency data from analyser
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume (intensity) from frequency data
        const averageVolume = this.calculateAverageVolume();
        
        // Update flame based on audio intensity
        this.updateFlame(averageVolume);
        
        // Update audio visualizer
        this.updateAudioVisualizer();
        
        // Update the flame intensity bar
        this.updateIntensityBar(averageVolume);
        
        // Show 'Blow harder!' message if blowing hard but not extinguished
        this.updateFlameMessage(averageVolume);
        
        // Continue analysis loop
        requestAnimationFrame(() => this.startAudioAnalysis());
    }
    
    /**
     * Calculate average volume from frequency data
     * This focuses on lower frequencies which are more characteristic of blowing
     */
    calculateAverageVolume() {
        if (!this.dataArray) return 0;
        
        let sum = 0;
        let count = 0;
        
        // Focus on lower frequencies (0-50% of the spectrum) for better blow detection
        const focusRange = Math.floor(this.dataArray.length * 0.5);
        
        for (let i = 0; i < focusRange; i++) {
            sum += this.dataArray[i];
            count++;
        }
        
        // Normalize to 0-1 range
        return count > 0 ? (sum / count) / 255 : 0;
    }
    
    /**
     * Update flame behavior based on audio intensity
     * @param {number} volume - Normalized volume level (0-1)
     */
    updateFlame(volume) {
        // Remove any existing flame classes
        this.flame.classList.remove('blowing-gentle', 'blowing-hard');
        
        // Check if flame is already extinguished
        if (this.flameExtinguished) {
            return;
        }
        
        // Determine flame behavior based on volume thresholds
        if (volume > this.EXTINGUISH_THRESHOLD) {
            // High volume - check if sustained long enough to extinguish
            if (!this.isHighVolume) {
                this.isHighVolume = true;
                this.highVolumeStartTime = Date.now();
            } else if (Date.now() - this.highVolumeStartTime > this.EXTINGUISH_DURATION) {
                // Sustained high volume - extinguish flame
                this.extinguishFlame();
                return;
            }
            
            // Hard blowing animation
            this.flame.classList.add('blowing-hard');
            
        } else if (volume > this.HARD_BLOW_THRESHOLD) {
            // Medium-high volume - hard blowing
            this.isHighVolume = false;
            this.flame.classList.add('blowing-hard');
            
        } else if (volume > this.GENTLE_BLOW_THRESHOLD) {
            // Low-medium volume - gentle blowing
            this.isHighVolume = false;
            this.flame.classList.add('blowing-gentle');
            
        } else {
            // Low volume - normal flickering
            this.isHighVolume = false;
        }
        
        console.log(`Volume: ${volume.toFixed(3)}, Flame state: ${this.getFlameState()}`);
    }
    
    /**
     * Get current flame state for debugging
     */
    getFlameState() {
        if (this.flame.classList.contains('extinguished')) return 'extinguished';
        if (this.flame.classList.contains('blowing-hard')) return 'blowing-hard';
        if (this.flame.classList.contains('blowing-gentle')) return 'blowing-gentle';
        return 'normal';
    }
    
    /**
     * Extinguish the flame and trigger celebration
     */
    extinguishFlame() {
        this.flameExtinguished = true;
        this.flame.classList.add('extinguished');
        // Hide the flame after the extinguish animation
        setTimeout(() => {
            this.flame.style.display = 'none';
        }, 600); // match animation duration
        console.log('Flame extinguished! 🎉');
        // Trigger confetti celebration after a short delay
        setTimeout(() => {
            this.triggerCelebration();
        }, 500);
    }
    
    /**
     * Reset flame to normal state
     */
    resetFlame() {
        this.flameExtinguished = false;
        this.flame.classList.remove('blowing-gentle', 'blowing-hard', 'extinguished');
        this.flame.style.display = '';
        this.flameMessageAppearances = 0;
        this.flameMessageWasActive = false;
    }
    
    /**
     * Trigger confetti celebration animation
     */
    triggerCelebration() {
        console.log('🎊 Starting celebration! 🎊');
        
        // Create confetti pieces
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                this.createConfetti();
            }, i * 20); // Stagger confetti creation
        }
        
        // Play celebration sound (if supported)
        this.playCelebrationSound();
    }
    
    /**
     * Create a single confetti piece
     */
    createConfetti() {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Randomize confetti properties
        const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8e53'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = randomColor;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        this.confettiContainer.appendChild(confetti);
        
        // Remove confetti after animation completes
        setTimeout(() => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 3000);
    }
    
    /**
     * Play celebration sound using Web Audio API
     */
    playCelebrationSound() {
        try {
            if (!this.audioContext) return;
            
            // Create oscillator for celebration sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Create a simple melody
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            let currentNote = 0;
            
            const playNote = () => {
                if (currentNote >= notes.length) return;
                
                oscillator.frequency.setValueAtTime(notes[currentNote], this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                currentNote++;
                setTimeout(playNote, 200);
            };
            
            oscillator.start();
            playNote();
            
            // Stop oscillator after melody
            setTimeout(() => {
                oscillator.stop();
            }, 1000);
            
        } catch (error) {
            console.log('Could not play celebration sound:', error);
        }
    }
    
    /**
     * Update audio visualizer display
     */
    updateAudioVisualizer() {
        if (!this.dataArray || !this.audioCtx) return;
        
        const canvas = this.audioCanvas;
        const ctx = this.audioCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw frequency bars
        const barWidth = width / this.dataArray.length;
        let x = 0;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            const barHeight = (this.dataArray[i] / 255) * height;
            
            // Create gradient for bars
            const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, '#4ecdc4');
            gradient.addColorStop(1, '#44a08d');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
            
            x += barWidth;
        }
    }
    
    /**
     * Update the flame intensity bar
     */
    updateIntensityBar(volume) {
        if (!this.intensityBar) return;
        const percent = Math.min(100, Math.round(volume * 100));
        this.intensityBar.style.height = percent + '%';
    }
    /**
     * Show 'Blow harder!' message if blowing hard but not extinguished
     */
    updateFlameMessage(volume) {
        if (!this.flameMessage) return;
        const shouldShow = (
            !this.flameExtinguished &&
            volume > this.HARD_BLOW_THRESHOLD &&
            volume < this.EXTINGUISH_THRESHOLD
        );
        if (shouldShow) {
            this.flameMessage.textContent = 'Blow harder!';
            this.flameMessage.classList.add('active');
            if (!this.flameMessageWasActive) {
                this.flameMessageAppearances++;
                this.flameMessageWasActive = true;
                if (this.flameMessageAppearances >= 3 && !this.flameExtinguished) {
                    this.extinguishFlame();
                }
            }
        } else {
            this.flameMessage.textContent = '';
            this.flameMessage.classList.remove('active');
            this.flameMessageWasActive = false;
        }
    }
    
    /**
     * Reset microphone UI to initial state
     */
    resetMicrophoneUI() {
        // this.startMicButton.textContent = '�� Start Microphone'; // Removed button
        // this.startMicButton.disabled = false; // Removed button
        // this.startMicButton.classList.remove('loading'); // Removed button
        // this.micStatus.textContent = 'Microphone: Disabled'; // Removed button
        // this.micStatus.classList.remove('active'); // Removed button
    }
    
    /**
     * Show error message to user
     */
    showError(message) {
        console.error(message);
        // this.micStatus.textContent = `Error: ${message}`; // Removed button
        // this.micStatus.style.color = '#ff6b6b'; // Removed button
    }
}

// Initialize the birthday cake when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎂 Initializing Interactive Birthday Cake...');
    new BirthdayCake();
});

// Handle page visibility changes to pause/resume audio
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden - audio analysis paused');
    } else {
        console.log('Page visible - audio analysis resumed');
    }
});

// Handle window resize for responsive audio visualizer
window.addEventListener('resize', () => {
    const audioCanvas = document.getElementById('audioCanvas');
    if (audioCanvas) {
        audioCanvas.width = audioCanvas.offsetWidth;
        audioCanvas.height = audioCanvas.offsetHeight;
    }
}); 