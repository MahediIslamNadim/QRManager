import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Features = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/#features", { replace: true });
  }, [navigate]);
  return null;
};

export default Features;
