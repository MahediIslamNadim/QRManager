import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Demo = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/menu/demo", { replace: true });
  }, [navigate]);
  return null;
};

export default Demo;
