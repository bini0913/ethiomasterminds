import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function NativeBackHandler(){
 const navigate=useNavigate(); const location=useLocation();
 useEffect(()=>{
   const handler=()=>{
     if(location.pathname==="/") return;
     if(window.history.length>1) navigate(-1); else navigate("/");
   };
   window.addEventListener("nativeBackButton",handler);
   return()=>window.removeEventListener("nativeBackButton",handler);
 },[navigate,location.pathname]);
 return null;
}
