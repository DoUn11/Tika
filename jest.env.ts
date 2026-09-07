/**
 * 테스트 실행 전 환경 변수를 로드한다.
 *
 * next/jest도 .env.test를 자동으로 읽지만, 테스트가 어느 DB에 붙는지
 * 설정에서 명시적으로 드러나도록 여기서도 로드한다.
 * 이미 설정된 값은 덮어쓰지 않는다.
 */
import { config } from 'dotenv';

config({ path: '.env.test', quiet: true });
