import fetchGagagasp from "./fetch-gagagasp";
import fetchTigerlee from "./fetch-tigerlee";
import fetchAllXPosts from "./fetch-x-posts";

async function main() {
  console.log("=== 推しポータル データ取得 ===\n");

  const results: { name: string; success: boolean }[] = [];

  // ガガガSP
  try {
    await fetchGagagasp();
    results.push({ name: "ガガガSP", success: true });
  } catch (err) {
    console.error("[ガガガSP] エラー:", err);
    results.push({ name: "ガガガSP", success: false });
  }

  console.log();

  // タイガーリー
  try {
    await fetchTigerlee();
    results.push({ name: "タイガーリー", success: true });
  } catch (err) {
    console.error("[タイガーリー] エラー:", err);
    results.push({ name: "タイガーリー", success: false });
  }

  // Xポスト
  try {
    await fetchAllXPosts();
    results.push({ name: "Xポスト", success: true });
  } catch (err) {
    console.error("[Xポスト] エラー:", err);
    results.push({ name: "Xポスト", success: false });
  }

  console.log("\n=== 結果サマリー ===");
  for (const r of results) {
    console.log(`  ${r.success ? "✅" : "❌"} ${r.name}`);
  }

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
