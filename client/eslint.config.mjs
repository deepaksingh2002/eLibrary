import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
	...nextCoreWebVitals,
	...nextTypeScript,
	{
		rules: {
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/purity": "off",
			"react-hooks/incompatible-library": "off",
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
];

export default config;