import React from "react";

type RiskStatus = "safe" | "caution" | "danger";

interface RiskBadgeProps {
  status: RiskStatus;
}

export default function RiskBadge({ status }: RiskBadgeProps) {
  const styles = {
    safe: {
      text: "● Safe",
      textColor: "#22C55E",
      backgroundColor: "#22C55E15",
      borderColor: "#22C55E40",
    },
    caution: {
      text: "● Caution",
      textColor: "#F59E0B",
      backgroundColor: "#F59E0B15",
      borderColor: "#F59E0B40",
    },
    danger: {
      text: "● Danger",
      textColor: "#EF4444",
      backgroundColor: "#EF444415",
      borderColor: "#EF444440",
    },
  };

  const style = styles[status];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: "10px",
        paddingRight: "10px",
        paddingTop: "4px",
        paddingBottom: "4px",
        borderRadius: "999px",
        border: `1px solid ${style.borderColor}`,
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        fontFamily: "Inter, sans-serif",
        fontSize: "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {style.text}
    </div>
  );
}
