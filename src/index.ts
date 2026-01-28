import { app } from "./app";

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

app.listen(PORT, () => {
    console.log(`Auth Service is running on port ${PORT}`);
});
