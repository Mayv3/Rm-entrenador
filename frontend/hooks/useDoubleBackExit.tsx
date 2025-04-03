 "use client";
import { useEffect, useRef } from "react";

function useDoubleBackExit(isModalOpen) {
  const lastPress = useRef(0);

  useEffect(() => {
    const handlePopState = () => {
      if (isModalOpen) return;

      const now = Date.now();
      if (now - lastPress.current < 2000) {
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
      } else {
        alert("Presiona dos veces para salir");
        lastPress.current = now;
        window.history.pushState(null, "", window.location.href);
      }
    };

    // Empujamos un estado para interceptar el evento popstate
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isModalOpen]);
}

export default useDoubleBackExit;
