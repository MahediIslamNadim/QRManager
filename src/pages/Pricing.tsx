import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/#pricing", { replace: true });
  }, [navigate]);
  return null;
};

export default Pricing;
