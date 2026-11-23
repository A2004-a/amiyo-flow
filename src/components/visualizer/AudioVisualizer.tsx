import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  level: number;
  isRecording: boolean;
  isPaused: boolean;
  barCount?: number;
  height?: number;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  level,
  isRecording,
  isPaused,
  barCount = 28,
  height = 42,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const smoothBarsRef = useRef<number[]>(new Array(barCount).fill(0.1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const barWidth = Math.max(3, (width - (barCount - 1) * 3) / barCount);
      const centerY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        // Distance from center factor for wave aesthetics
        const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const centerFactor = 1 - distFromCenter * 0.45;

        let targetH = 0.08;
        if (isRecording && !isPaused) {
          const sineVariation = Math.sin(time + i * 0.4) * 0.25;
          targetH = Math.max(0.12, (level * 1.5 + sineVariation + 0.1) * centerFactor);
        } else if (isPaused) {
          targetH = 0.12;
        }

        // Smooth interpolation
        smoothBarsRef.current[i] += (targetH - smoothBarsRef.current[i]) * 0.22;
        const barH = Math.min(canvas.height * 0.9, smoothBarsRef.current[i] * canvas.height);

        const x = i * (barWidth + 3);
        const y = centerY - barH / 2;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        if (isRecording && !isPaused) {
          grad.addColorStop(0, '#06B6D4');
          grad.addColorStop(0.5, '#38BDF8');
          grad.addColorStop(1, '#8B5CF6');
        } else if (isPaused) {
          grad.addColorStop(0, '#F59E0B');
          grad.addColorStop(1, '#D97706');
        } else {
          grad.addColorStop(0, '#334155');
          grad.addColorStop(1, '#1E293B');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, Math.max(4, barH), 2.5);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [level, isRecording, isPaused, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 7}
      height={height}
      className={`block ${className}`}
    />
  );
};
