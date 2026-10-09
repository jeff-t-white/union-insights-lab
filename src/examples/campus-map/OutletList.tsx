type Outlet = {
  name: string;
  logoPath: string | null;
  orderUrl: string | null;
  locationUrl?: string;
};

export function OutletList({ outlets }: { outlets: Outlet[] }) {
  return <ul className="outlet-list">{outlets.map((outlet) => (
    <li key={outlet.name}>
      {outlet.logoPath && <img src={`${import.meta.env.BASE_URL}${outlet.logoPath}`} alt="" width="42" height="42" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
      <div><span>{outlet.name}</span>{outlet.orderUrl && <a href={outlet.orderUrl}>Mobile ordering ↗</a>}{outlet.locationUrl && <a href={outlet.locationUrl}>Location information & hours ↗</a>}</div>
    </li>
  ))}</ul>;
}
