import { Button } from "@material-ui/core";
import React, { useRef } from "react";
import { useEffect } from "react";
import { useState } from "react";

const LS_NAME = "audioMessageRate";

export default function AudioMessage({ url }) {
  const audioRef = useRef(null);
  const [audioRate, setAudioRate] = useState(
    parseFloat(localStorage.getItem(LS_NAME) || "1")
  );
  const [showButtonRate, setShowButtonRate] = useState(false);

  useEffect(() => {
    audioRef.current.playbackRate = audioRate;
    localStorage.setItem(LS_NAME, audioRate);
  }, [audioRate]);

  useEffect(() => {
    audioRef.current.onplaying = () => {
      setShowButtonRate(true);
    };
    audioRef.current.onpause = () => {
      setShowButtonRate(false);
    };
    audioRef.current.onended = () => {
      setShowButtonRate(false);
    };
  }, []);

  const toogleRate = () => {
    let newRate = null;

    switch (audioRate) {
      case 0.5:
        newRate = 1;
        break;
      case 1:
        newRate = 1.5;
        break;
      case 1.5:
        newRate = 2;
        break;
      case 2:
        newRate = 0.5;
        break;
      default:
        newRate = 1;
        break;
    }

    setAudioRate(newRate);
  };

  return (
    <div style={{ width: 280, maxWidth: "100%", padding: "4px 0" }}>
      <audio
        ref={audioRef}
        src={url}
        controls
        preload="metadata"
        style={{ width: "100%", maxWidth: "100%", height: 42 }}
        aria-label="Áudio da conversa"
      />
      {showButtonRate && (
        <Button
          size="small"
          aria-label={`Velocidade do áudio: ${audioRate} vezes`}
          style={{ minHeight: 28, marginTop: 4 }}
          onClick={toogleRate}
        >
          {audioRate}x
        </Button>
      )}
    </div>
  );
}
