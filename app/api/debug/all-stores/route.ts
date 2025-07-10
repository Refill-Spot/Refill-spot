import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  logger.info('디버그: 모든 가게 데이터 조회 시작...');
  
  try {
    const supabase = createRouteHandlerSupabaseClient(request);

    // 1. 전체 가게 수 조회
    const { count: totalCount, error: countError } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error('전체 가게 수 조회 오류:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // 2. 강남구 가게 조회
    const { data: gangnamStores, error: gangnamError } = await supabase
      .from('stores')
      .select('*')
      .like('address', '%강남구%');

    if (gangnamError) {
      logger.error('강남구 가게 조회 오류:', gangnamError);
      return NextResponse.json({ error: gangnamError.message }, { status: 500 });
    }

    // 3. 모든 가게 조회 (좌표 정보 포함)
    const { data: allStores, error: allError } = await supabase
      .from('stores')
      .select('id, name, address, position_lat, position_lng, naver_rating, kakao_rating')
      .not('position_lat', 'is', null)
      .not('position_lng', 'is', null)
      .order('id');

    if (allError) {
      logger.error('모든 가게 조회 오류:', allError);
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    // 4. 지역별 가게 분포
    const regions = {
      gangnam: allStores.filter(store => store.address.includes('강남구')),
      seocho: allStores.filter(store => store.address.includes('서초구')),
      yongsan: allStores.filter(store => store.address.includes('용산구')),
      junggu: allStores.filter(store => store.address.includes('중구')),
      others: allStores.filter(store => 
        !store.address.includes('강남구') && 
        !store.address.includes('서초구') && 
        !store.address.includes('용산구') && 
        !store.address.includes('중구')
      )
    };

    // 5. 좌표 범위 분석
    const coordinates = {
      latitudes: allStores.map(s => s.position_lat).filter(lat => lat != null),
      longitudes: allStores.map(s => s.position_lng).filter(lng => lng != null)
    };

    const coordinateStats = {
      latitude: {
        min: Math.min(...coordinates.latitudes),
        max: Math.max(...coordinates.latitudes),
        avg: coordinates.latitudes.reduce((a, b) => a + b, 0) / coordinates.latitudes.length
      },
      longitude: {
        min: Math.min(...coordinates.longitudes),
        max: Math.max(...coordinates.longitudes),
        avg: coordinates.longitudes.reduce((a, b) => a + b, 0) / coordinates.longitudes.length
      }
    };

    const debugInfo = {
      summary: {
        totalStores: totalCount,
        storesWithCoordinates: allStores.length,
        gangnamStores: gangnamStores.length,
        regionDistribution: {
          gangnam: regions.gangnam.length,
          seocho: regions.seocho.length,
          yongsan: regions.yongsan.length,
          junggu: regions.junggu.length,
          others: regions.others.length
        }
      },
      coordinateStats,
      gangnamStoreDetails: gangnamStores.map(store => ({
        id: store.id,
        name: store.name,
        address: store.address,
        coordinates: {
          lat: store.position_lat,
          lng: store.position_lng
        },
        ratings: {
          naver: store.naver_rating || 0,
          kakao: store.kakao_rating || 0
        }
      })),
      allStoresSample: allStores.slice(0, 10), // 처음 10개만 샘플로
      timestamp: new Date().toISOString()
    };

    logger.info(`디버그 조회 완료: 전체 ${totalCount}개, 강남구 ${gangnamStores.length}개`);

    return NextResponse.json({
      success: true,
      debug: debugInfo
    });

  } catch (error: any) {
    logger.error('디버그 API 오류:', error);
    return NextResponse.json(
      { error: '디버그 데이터 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}