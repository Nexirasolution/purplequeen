export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { formatINR } from '@/lib/utils';
import PrintButton from '@/components/PrintButton';

// Theme: #4B087A (royal purple), #F7B900 (gold), #FFF5E8 (ivory), #24052F (deep plum), #D9B4E8 (lavender)
const INK = '#24052F';          // primary text
const INK_SOFT = '#7A6685';     // muted text (derived plum-gray)
const PEACH = '#F7B900';        // accent (gold)
const PEACH_LIGHT = '#F3E6F8';  // accent background (light lavender)
const LINE = '#D9B4E8';         // borders (lavender)
const PAPER = '#FFF5E8';        // page background (ivory)
const PURPLE = '#4B087A';       // royal purple (labels, COD highlight)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default async function CourierBillPage({ params }) {
  await dbConnect();
  const order = await Order.findById(params.orderId).lean();
  const settings = await Settings.findOne({ key: 'global' }).lean();

  if (!order) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: INK_SOFT }}>
        Shipping label not found.
      </div>
    );
  }

  return (
    <div
      className="max-w-md mx-auto p-7 m-6"
      style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
    >
      <div
        className="flex justify-between items-center pb-4 mb-4"
        style={{ borderBottom: `1px dashed ${LINE}` }}
      >
        <h1 className="text-lg tracking-tight" style={{ fontFamily: FONT_SERIF, color: INK }}>
          Shipping Label
        </h1>
        <span
          className="text-[11px] font-mono px-2.5 py-1"
          style={{ background: PEACH_LIGHT, color: PURPLE, borderRadius: '2px' }}
        >
          {order.orderNumber}
        </span>
      </div>

      <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-1.5" style={{ color: PURPLE }}>
        From
      </p>
      <p className="text-sm" style={{ color: INK }}>{settings?.storeName || 'Shea Fashions'}</p>
      <p className="text-sm" style={{ color: INK_SOFT }}>{settings?.address || 'Tamil Nadu'}</p>

      <p className="text-[11px] font-medium uppercase tracking-[0.18em] mt-5 mb-1.5" style={{ color: PURPLE }}>
        To
      </p>
      <p className="text-sm" style={{ color: INK }}>{order.customer?.name}</p>
      <p className="text-sm" style={{ color: INK_SOFT }}>{order.customer?.phone}</p>
      <p className="text-sm" style={{ color: INK_SOFT }}>
        {order.shippingAddress?.line1}, {order.shippingAddress?.line2}
      </p>
      <p className="text-sm" style={{ color: INK_SOFT }}>
        {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
      </p>
      {order.shippingAddress?.landmark && (
        <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>
          Landmark: {order.shippingAddress.landmark}
        </p>
      )}

      <div className="mt-5 pt-4 text-sm space-y-2" style={{ borderTop: `1px dashed ${LINE}` }}>
        <div className="flex justify-between">
          <span style={{ color: INK_SOFT }}>Items</span>
          <span style={{ color: INK }}>{order.items.length}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: INK_SOFT }}>Payment</span>
          <span
            className={order.paymentMethod === 'cod' ? 'font-semibold' : ''}
            style={{ color: order.paymentMethod === 'cod' ? PURPLE : INK }}
          >
            {order.paymentMethod === 'cod' ? `COD - ${formatINR(order.total)}` : 'Prepaid'}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: INK_SOFT }}>Courier Partner</span>
          <span style={{ color: INK }}>{order.courier?.partner || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: INK_SOFT }}>AWB / Tracking No.</span>
          <span className="font-mono" style={{ color: INK }}>{order.courier?.awbNumber || '—'}</span>
        </div>
      </div>

      <div className="mt-6">
        <PrintButton label="Print Label" />
      </div>
    </div>
  );
}