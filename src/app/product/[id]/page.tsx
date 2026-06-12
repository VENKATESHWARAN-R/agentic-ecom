import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryMeta, products } from "@/lib/catalog";
import { getAlternatives, getProduct } from "@/lib/services";
import { ProductGrid, RatingStars } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { BuyBox } from "./buy-box";

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const alternatives = getAlternatives(product.id);

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / <Link href={`/c/${product.category}`}>{categoryMeta[product.category].label}</Link> /{" "}
        {product.name}
      </nav>

      <div className="pdp">
        <div className="pdp-media">
          <ProductVisual kind={product.visual} accent={product.accent} />
        </div>
        <div className="pdp-info">
          <div className="card-brand">{product.brand}</div>
          <h1>{product.name}</h1>
          <RatingStars rating={product.rating} count={product.reviewCount} />

          <BuyBox product={product} />

          <p>{product.description}</p>
          <ul className="highlights">
            {product.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>

          <section className="section">
            <div className="section-head">
              <h2>Specifications</h2>
            </div>
            <table className="spec-table">
              <tbody>
                {Object.entries(product.specs).map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {alternatives.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{product.stock <= 0 ? "In stock alternatives" : "Similar products"}</h2>
          </div>
          <ProductGrid products={alternatives} />
        </section>
      )}
    </>
  );
}
