import { useContext, useEffect, useRef, useState } from "react";

function makeObservable(target: any) {
    let listeners:any[] = []; // initial listeners can be passed an an argument aswell
    let value = target;
  
    function get() {
      return value;
    }
  
    function set(newValue:any) {
      if (value === newValue) return;
      value = newValue;
      listeners.forEach((l) => l(value));
    }
  
    function subscribe(listenerFunc:any) {
      listeners.push(listenerFunc);
      return () => unsubscribe(listenerFunc); // will be used inside React.useEffect
    }
  
    function unsubscribe(listenerFunc:any) {
      listeners = listeners.filter((l) => l !== listenerFunc);
    }
  
    return {
      get,
      set,
      subscribe,
    };
}

export const memosInput = makeObservable(false);

export function useMemosInput(): [boolean, (enable: boolean) => void] {
    const [enable, setEnable] = useState<boolean>(memosInput.get());

    useEffect(() => {
        return memosInput.subscribe(setEnable);
      }, []);

    return [enable, setEnable];
}
